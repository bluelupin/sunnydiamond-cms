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

const template = load('src/emails/try-at-home-confirmed.ts').tryAtHomeConfirmedTemplate;
const { sendTryAtHomeConfirmationEmail: send } = load('src/utils/try-at-home-confirmation-email.ts');

function mailMock(fail = false) {
  const sent = [], errors = [];
  return { sent, errors, log: { info() {}, error: message => errors.push(message) },
    plugin: () => ({ service: () => ({ send: async message => { if (fail) throw new Error('secret'); sent.push(message); } }) }) };
}

test('Try at Home template uses adapted wording and escapes dynamic values', () => {
  const message = template({ appointmentId: '<group-1>', customerName: '<Customer & Co>', appointmentDate: '2099-10-06',
    appointmentTime: '<11:00 AM>', deliveryAddress: '<Home & Street>', productName: '<Diamond Ring & Pendant>',
    manageUrl: 'https://example.com?a=1&b=2' });
  assert.equal(message.subject, 'Your Sunny Diamonds Try at Home Appointment Is Confirmed');
  assert.match(message.text, /Appointment ID: <group-1>/);
  assert.match(message.text, /Selected Jewellery\n\n<Diamond Ring & Pendant>/);
  assert.match(message.text, /comfort of your home/);
  assert.match(message.html, /&lt;Customer &amp; Co&gt;/);
  assert.match(message.html, /&lt;Diamond Ring &amp; Pendant&gt;/);
  assert.match(message.html, /a=1&amp;b=2/);
});

test('delivery builds the home address and targets a valid customer email', async () => {
  const previous = process.env.APPOINTMENT_MANAGE_URL;
  process.env.APPOINTMENT_MANAGE_URL = 'https://example.com/manage';
  try {
    const strapi = mailMock();
    const data = { documentId: 'product-1', appointmentId: 'group-1', productName: 'Diamond Ring',
      customerName: 'Customer', customerEmail: 'customer@example.com',
      requestedDate: '2099-10-06', selectedTimeSlot: '11:00 AM', addressLine1: 'House 1', addressLine2: 'MG Road',
      city: 'Kochi', state: 'Kerala', pincode: '123456' };
    await send(strapi, data);
    assert.equal(strapi.sent.length, 1);
    assert.match(strapi.sent[0].text, /Delivery Address: House 1, MG Road, Kochi, Kerala, 123456/);
    assert.match(strapi.sent[0].html, /documentId=product-1/);
    await send(strapi, { ...data, customerEmail: 'bad\r\nBcc:x@example.com' });
    assert.equal(strapi.sent.length, 1);
  } finally {
    if (previous === undefined) delete process.env.APPOINTMENT_MANAGE_URL;
    else process.env.APPOINTMENT_MANAGE_URL = previous;
  }
});

test('provider failures remain best-effort', async () => {
  const strapi = mailMock(true);
  await assert.doesNotReject(send(strapi, { documentId: 'product-1', appointmentId: 'group-1', productName: 'Diamond Ring', customerName: 'Customer',
    customerEmail: 'customer@example.com', requestedDate: '2099-10-06', selectedTimeSlot: '11:00 AM' }));
  assert.equal(strapi.errors.length, 1);
});
