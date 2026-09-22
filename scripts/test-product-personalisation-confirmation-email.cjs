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

const template = load('src/emails/product-personalisation-confirmation.ts').productPersonalisationConfirmationTemplate;
const { sendProductPersonalisationConfirmationEmail: send } = load('src/utils/product-personalisation-confirmation-email.ts');

function mailMock(fail = false) {
  const sent = [], errors = [];
  return { sent, errors, log: { info() {}, error: message => errors.push(message) },
    plugin: () => ({ service: () => ({ send: async message => {
      if (fail) throw new Error('secret-provider-details');
      sent.push(message);
    } }) }),
  };
}

test('personalisation acknowledgement includes request details and escapes customer data', () => {
  const message = template({ customerName: '<Customer & Co>', productName: '<Diamond Ring>', requestDetails: 'Engrave A & B' });
  assert.equal(message.subject, 'We’ve Received Your Personalisation Request – Sunny Diamonds');
  assert.match(message.text, /Personalisation Request: Engrave A & B/);
  assert.match(message.html, /Dear &lt;Customer &amp; Co&gt;/);
  assert.match(message.html, /&lt;Diamond Ring&gt;/);
  assert.ok(!message.html.includes('<Customer'));
});

test('confirmation is sent only to a valid customer email and provider failures remain best-effort', async () => {
  const data = { documentId: 'request-1', customerName: 'Customer', customerEmail: 'customer@example.com',
    productName: 'Diamond Ring', requestDetails: 'Custom engraving' };
  const strapi = mailMock();
  await send(strapi, data);
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.sent[0].to, data.customerEmail);
  for (const customerEmail of [undefined, '', 'a@example.com,b@example.com', 'bad\r\nBcc:x@example.com']) await send(strapi, { ...data, customerEmail });
  assert.equal(strapi.sent.length, 1);
  const failing = mailMock(true);
  await assert.doesNotReject(send(failing, data));
  assert.equal(failing.errors.length, 1);
  assert.ok(!failing.errors[0].includes('secret-provider-details'));
});
