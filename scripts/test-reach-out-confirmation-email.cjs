const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (!name.startsWith('.')) return require(name);
    return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')));
  }, module, module.exports);
  return module.exports;
}

const template = load('src/emails/reach-out-confirmation.ts').reachOutConfirmationTemplate;
const { sendReachOutConfirmationEmail: send } = load('src/utils/reach-out-confirmation-email.ts');

function mailMock(fail = false) {
  const sent = [], errors = [];
  return { sent, errors, log: { info() {}, error: message => errors.push(message) },
    plugin: () => ({ service: () => ({ send: async message => {
      if (fail) throw new Error('secret-provider-details');
      sent.push(message);
    } }) }),
  };
}

test('reach-out template matches the supplied copy and escapes the customer name', () => {
  const message = template({ customerName: '<Customer & Co>' });
  assert.equal(message.subject, 'We’ve Received Your Message – Sunny Diamonds');
  assert.match(message.text, /review your enquiry and get back to you shortly/);
  assert.match(message.html, /Dear &lt;Customer &amp; Co&gt;/);
  assert.ok(!message.html.includes('<Customer'));
});

test('confirmation is delivered only to a valid customer email', async () => {
  const strapi = mailMock();
  const data = { documentId: 'submission-1', customerName: 'Customer', customerEmail: 'customer@example.com' };
  await send(strapi, data);
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.sent[0].to, data.customerEmail);
  for (const customerEmail of [undefined, '', 'a@example.com,b@example.com', 'bad\r\nBcc:x@example.com']) {
    await send(strapi, { ...data, customerEmail });
  }
  assert.equal(strapi.sent.length, 1);
});

test('provider failure does not fail the saved enquiry or leak provider details', async () => {
  const strapi = mailMock(true);
  await assert.doesNotReject(send(strapi, {
    documentId: 'submission-1', customerName: 'Customer', customerEmail: 'customer@example.com',
  }));
  assert.equal(strapi.errors.length, 1);
  assert.ok(!strapi.errors[0].includes('secret-provider-details'));
});
