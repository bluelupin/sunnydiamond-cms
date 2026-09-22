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
const template = load('src/emails/try-at-home-reminder.ts').tryAtHomeReminderTemplate;
const { sendTomorrowTryAtHomeReminders: run } = load('src/utils/try-at-home-reminder.ts');

test('Try at Home reminder follows supplied copy, lists products, and escapes values', () => {
  const message = template({ appointmentId: '<group-1>', customerName: '<Customer & Co>', appointmentDate: '2026-10-01',
    appointmentTime: '<10:00 AM>', deliveryAddress: '<Home & Street>', productNames: ['<Ring & Pendant>', 'Earrings'],
    manageUrl: 'https://example.com/manage?a=1&b=2' });
  assert.equal(message.subject, 'Reminder: Your Sunny Diamonds Try at Home Appointment Is Tomorrow');
  assert.match(message.text, /Appointment ID: <group-1>/);
  assert.match(message.text, /<Ring & Pendant>\nEarrings/);
  assert.match(message.html, /&lt;Customer &amp; Co&gt;/);
  assert.match(message.html, /&lt;Ring &amp; Pendant&gt;/);
  assert.match(message.html, /a=1&amp;b=2/);
});

test('daily job sends one group reminder and marks only a successful delivery', async () => {
  const previous = process.env.APPOINTMENT_MANAGE_URL;
  process.env.APPOINTMENT_MANAGE_URL = 'https://example.com/manage';
  try {
    const sent = [], updates = [];
    const groups = [{ documentId: 'group-1', workflowStatus: 'Scheduled', requestedDate: '2026-10-01', selectedTimeSlot: '10:00 AM',
      addressLine1: 'House 1', city: 'Kochi', state: { name: 'Kerala' }, pincode: '123456', submissions: [
        { documentId: 'product-1', customerName: 'Customer', customerEmail: 'customer@example.com', productName: 'Diamond Ring' },
        { documentId: 'product-2', customerName: 'Customer', customerEmail: 'customer@example.com', productName: 'Pendant' },
      ] }, { documentId: 'cancelled', workflowStatus: 'Cancelled', requestedDate: '2026-10-01', submissions: [] },
      { documentId: 'duplicate', workflowStatus: 'Scheduled', requestedDate: '2026-10-01', reminderSentForDate: '2026-10-01', submissions: [] }];
    const strapi = { log: { info() {}, error() {} }, plugin: () => ({ service: () => ({ send: async mail => sent.push(mail) }) }),
      documents: () => ({ findMany: async () => groups, update: async request => updates.push(request) }) };
    const result = await run(strapi, '2026-09-30');
    assert.deepEqual(result, { appointmentDate: '2026-10-01', sent: 1 });
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /Diamond Ring\nPendant/);
    assert.match(sent[0].text, /Delivery Address: House 1, Kochi, Kerala, 123456/);
    assert.equal(updates[0].documentId, 'group-1');
  } finally {
    if (previous === undefined) delete process.env.APPOINTMENT_MANAGE_URL;
    else process.env.APPOINTMENT_MANAGE_URL = previous;
  }
});
