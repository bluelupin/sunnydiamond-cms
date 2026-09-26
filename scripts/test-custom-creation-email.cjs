const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, stubs = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (!name.startsWith('.')) return require(name);
    return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), stubs);
  }, module, module.exports);
  return module.exports;
}
const { customCreationReceivedTemplate: template } = load('src/emails/custom-creation-received.ts');
const { sendCustomCreationReceivedEmail: send } = load('src/utils/custom-creation-email.ts');

test('acknowledgement escapes names and includes shared branding and plain text', () => {
  const message = template({ customerName: '<Customer & Co>' });
  assert.match(message.html, /Dear &lt;Customer &amp; Co&gt;/);
  assert.ok(!message.html.includes('<Customer'));
  assert.match(message.html, /cid:sunny-diamonds-logo/);
  assert.match(message.html, /Questions\? Just reply/);
  assert.match(message.text, /received your request/);
  assert.equal(message.attachments[0].cid, 'sunny-diamonds-logo');
  assert.match(template({}).text, /Dear Customer,/);
});

test('invalid recipients are skipped and delivery failures are contained', async () => {
  const errors = [];
  let attempts = 0;
  const strapi = { log: { error: message => errors.push(message) }, plugin: () => ({ service: () => ({
    send: async () => { attempts++; throw new Error('private-provider-error'); },
  }) }) };
  for (const customerEmail of [undefined, '', 'a@example.com,b@example.com', 'bad\r\nBcc:x@example.com']) {
    await send(strapi, { documentId: 'request-1', customerEmail });
  }
  assert.equal(attempts, 0);
  await assert.doesNotReject(send(strapi, { documentId: 'request-1', customerEmail: 'customer@example.com' }));
  assert.equal(attempts, 1);
  assert.equal(errors.length, 1);
  assert.ok(!errors[0].includes('private-provider-error'));
});

test('submission emails only after saving and optional upload; provider errors preserve success', async () => {
  for (const scenario of ['success', 'no-image', 'invalid', 'save-failure', 'upload-failure', 'email-failure']) {
    const events = [], sent = [];
    const strapi = {
      log: { info() {}, error() {} },
      documents: () => ({
        findFirst: async () => ({ customDesignForm: { showField: true } }),
        create: async () => {
          events.push('save');
          if (scenario === 'save-failure') throw new Error(scenario);
          return { id: 1, documentId: 'request-1' };
        },
      }),
      plugin: plugin => ({ service: () => plugin === 'upload' ? {
        upload: async () => { events.push('upload'); if (scenario === 'upload-failure') throw new Error(scenario); },
      } : { send: async message => {
        events.push('email');
        if (scenario === 'email-failure') throw new Error(scenario);
        sent.push(message);
      } } }),
    };
    const controller = load('src/api/bespoke-submission/controllers/bespoke-submission.ts', {
      '@strapi/strapi': { factories: { createCoreController: (_, factory) => factory({ strapi }) } },
      '../../../utils/form-submission-rate-limit': { checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => '127.0.0.1' },
      '../../../utils/request-locale': { requestLocale: () => 'en' },
    }).default;
    const ctx = { ip: '127.0.0.1', badRequest: error => ({ error }), request: {
      body: { fullName: 'Customer', phone: '9876543210', email: 'CUSTOMER@example.com',
        designVision: scenario === 'invalid' ? '' : 'A custom ring' },
      files: scenario === 'no-image' ? undefined : { referenceImage: { mimetype: 'image/png', size: 100 } },
    } };
    if (['save-failure', 'upload-failure'].includes(scenario)) {
      await assert.rejects(controller.submit(ctx), new RegExp(scenario));
      assert.ok(!events.includes('email'));
    } else {
      const result = await controller.submit(ctx);
      if (scenario === 'invalid') assert.deepEqual(events, []);
      else {
        assert.equal(result.data.documentId, 'request-1');
        assert.deepEqual(events, scenario === 'no-image' ? ['save', 'email'] : ['save', 'upload', 'email']);
        if (scenario !== 'email-failure') {
          assert.equal(sent.length, 1);
          assert.equal(sent[0].to, 'customer@example.com');
        }
      }
    }
  }
});
