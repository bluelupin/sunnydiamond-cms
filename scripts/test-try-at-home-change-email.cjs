const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts'))) : require(name), module, module.exports);
  return module.exports;
}
const { sendTryAtHomeRescheduledEmail: reschedule, sendTryAtHomeCancelledEmail: cancel } = load('src/utils/try-at-home-change-email.ts');
const data = { documentId: 'group-1', manageDocumentId: 'product-1', customerName: 'Customer', customerEmail: 'customer@example.com',
  requestedDate: '2099-10-06', selectedTimeSlot: '11:00 AM', addressLine1: 'House 1', city: 'Kochi', state: 'Kerala',
  pincode: '123456', productNames: ['Diamond Ring', 'Diamond Pendant'], sourcePage: 'https://example.com/product' };
function mock() { const sent = []; return { sent, log: { info() {}, error() {} },
  plugin: () => ({ service: () => ({ send: async mail => sent.push(mail) }) }) }; }

test('group reschedule email contains every product in the appointment', async () => {
  const previous = process.env.APPOINTMENT_MANAGE_URL;
  process.env.APPOINTMENT_MANAGE_URL = 'https://example.com/manage';
  try {
    const strapi = mock(); await reschedule(strapi, data);
    assert.equal(strapi.sent.length, 1);
    assert.match(strapi.sent[0].text, /- Diamond Ring\n- Diamond Pendant/);
    assert.match(strapi.sent[0].text, /New Date: Oct 6, 2099/);
    assert.match(strapi.sent[0].text, /successfully rescheduled as requested/);
    assert.match(strapi.sent[0].text, /creating a personalised experience from the comfort of your home/);
  } finally { if (previous === undefined) delete process.env.APPOINTMENT_MANAGE_URL; else process.env.APPOINTMENT_MANAGE_URL = previous; }
});

test('group cancellation email contains every product in the appointment', async () => {
  const strapi = mock(); await cancel(strapi, data);
  assert.equal(strapi.sent.length, 1);
  assert.match(strapi.sent[0].text, /Diamond Ring\nDiamond Pendant/);
  assert.match(strapi.sent[0].text, /Date: Oct 6, 2099/);
  assert.match(strapi.sent[0].text, /schedule another Try at Home experience/);
  assert.match(strapi.sent[0].html, />Book a New Appointment</);
});
