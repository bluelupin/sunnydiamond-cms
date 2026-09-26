const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const nodemailer = require('nodemailer');

function loadProvider(send = async () => ({ data: { id: 'gmail-message-id' } })) {
  const calls = [];
  let credentials, client;
  const google = {
    auth: { OAuth2: class {
      constructor(id, secret) { client = { id, secret }; }
      setCredentials(value) { credentials = value; }
    } },
    gmail: () => ({ users: { messages: { send: async (...args) => {
      calls.push(args);
      return send(...args);
    } } } }),
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8'), {
    module, require: name => name === 'googleapis' ? { google } : nodemailer,
  });
  return { provider: module.exports, calls, auth: () => ({ client, credentials }) };
}
const options = { clientId: 'test-client', clientSecret: 'test-secret', refreshToken: 'test-refresh-token' };
const settings = {
  defaultFrom: 'Sunny Diamonds News Letters <mailer@mailer.sunnydiamonds.com>',
  defaultReplyTo: 'customerservice@sunnydiamonds.com',
};

test('provider composes multipart MIME and calls Gmail with refresh-token auth', async () => {
  const mock = loadProvider();
  const result = await mock.provider.init(options, settings).send({
    to: 'customer@example.com', cc: 'copy@example.com', bcc: 'private@example.com',
    subject: 'Appointment updated', text: 'Updated appointment', html: '<p>Updated appointment</p>',
    attachments: [{ filename: 'details.txt', content: 'Appointment details' }],
  });
  assert.equal(result.id, 'gmail-message-id');
  assert.equal(mock.auth().client.id, options.clientId);
  assert.equal(mock.auth().credentials.refresh_token, options.refreshToken);
  assert.equal(mock.calls.length, 1);
  const [request, transportOptions] = mock.calls[0];
  assert.equal(request.userId, 'me');
  assert.equal(transportOptions.retry, false);
  assert.equal(transportOptions.timeout, 30000);
  assert.match(request.requestBody.raw, /^[A-Za-z0-9_-]+$/);
  const mime = Buffer.from(request.requestBody.raw, 'base64url').toString('utf8');
  for (const value of ['mailer@mailer.sunnydiamonds.com', 'customerservice@sunnydiamonds.com',
    'To: customer@example.com', 'Cc: copy@example.com', 'Bcc: private@example.com',
    'text/plain', 'text/html', 'details.txt']) assert.ok(mime.includes(value), value);
  assert.ok(!mime.includes(options.refreshToken));
});

test('missing credentials allow initialization but reject sending without API calls', async () => {
  const mock = loadProvider();
  const provider = mock.provider.init({}, settings);
  await assert.rejects(provider.send({ to: 'customer@example.com', text: 'Test' }), /GOOGLE_MAIL_REFRESH_TOKEN/);
  assert.equal(mock.calls.length, 0);
});

test('missing sender or recipients rejects before contacting Gmail', async () => {
  const mock = loadProvider();
  await assert.rejects(mock.provider.init(options).send({ to: 'customer@example.com' }), /EMAIL_FROM/);
  await assert.rejects(mock.provider.init(options, settings).send({ text: 'Test' }), /recipient/);
  assert.equal(mock.calls.length, 0);
});

test('API errors are sanitized and expired refresh tokens are actionable', async () => {
  for (const [status, reason, expected] of [
    [400, 'invalid_grant', /reauthorize/], [401, 'invalid_client', /authentication failed/],
    [403, { message: 'secret' }, /access denied/], [429, {}, /HTTP 429/],
    [undefined, {}, /delivery request failed/],
  ]) {
    const mock = loadProvider(async () => { throw {
      response: { status, data: { error: reason } },
      config: { headers: { Authorization: 'Bearer test-access-token' } },
    }; });
    await assert.rejects(mock.provider.init(options, settings).send({ to: 'customer@example.com', text: 'Test' }), error => {
      assert.match(error.message, expected);
      assert.ok(!error.message.includes('test-access-token'));
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(mock.calls.length, 1);
  }
});

test('attachments cannot read local files or fetch URLs', async () => {
  for (const attachment of [
    { filename: 'file.txt', path: __filename },
    { filename: 'file.txt', href: 'https://example.com/private' },
  ]) {
    const mock = loadProvider();
    await assert.rejects(mock.provider.init(options, settings).send({
      to: 'customer@example.com', text: 'Test', attachments: [attachment],
    }), /access rejected/i);
    assert.equal(mock.calls.length, 0);
  }
});

test('Strapi resolves the installed local provider and passes environment settings', () => {
  const ts = require('typescript');
  const filename = path.resolve(__dirname, '../../config/plugins.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module });
  const values = { GOOGLE_MAIL_CLIENT_ID: options.clientId, GOOGLE_MAIL_CLIENT_SECRET: options.clientSecret,
    GOOGLE_MAIL_REFRESH_TOKEN: options.refreshToken };
  const env = (name, fallback) => values[name] ?? fallback;
  env.int = env;
  const config = module.exports.default({ env }).email.config;
  const installed = require(config.provider);
  assert.equal(typeof installed.init, 'function');
  assert.equal(config.providerOptions.refreshToken, options.refreshToken);
  assert.equal(config.settings.defaultFrom, settings.defaultFrom);
  assert.equal(config.settings.defaultReplyTo, settings.defaultReplyTo);
});
