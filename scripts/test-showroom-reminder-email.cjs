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

const template = load('src/emails/showroom-appointment-reminder.ts').showroomAppointmentReminderTemplate;
const { nextCalendarDate, sendTomorrowShowroomAppointmentReminders: run } = load('src/utils/showroom-appointment-reminder.ts');

test('reminder template follows supplied copy and escapes dynamic values', () => {
  const message = template({ customerName: '<Customer & Co>', appointmentDate: '2099-10-06',
    appointmentTime: '<11:00 AM>', showroomName: '<Kochi>', showroomAddress: 'MG Road & South',
    manageUrl: 'https://example.com/manage?a=1&b=2' });
  assert.equal(message.subject, 'Reminder: Your Sunny Diamonds Appointment Is Tomorrow');
  assert.match(message.text, /Appointment Type: Showroom Visit/);
  assert.match(message.html, /&lt;Customer &amp; Co&gt;/);
  assert.match(message.html, /a=1&amp;b=2/);
});

test('calendar calculation crosses month and year boundaries', () => {
  assert.equal(nextCalendarDate('2026-09-30'), '2026-10-01');
  assert.equal(nextCalendarDate('2026-12-31'), '2027-01-01');
});

test('daily job sends eligible reminders once and marks only successful deliveries', async () => {
  const previous = process.env.APPOINTMENT_MANAGE_URL;
  process.env.APPOINTMENT_MANAGE_URL = 'https://example.com/manage';
  try {
    const sent = [], updates = [];
    const appointments = [
      { documentId: 'send', formTag: 'product-store-visit', workflowStatus: 'Scheduled', customerName: 'Customer',
        customerEmail: 'customer@example.com', requestedDate: '2026-10-01', selectedTimeSlot: '10:00 AM',
        preferredShowroom: { address: '<p>MG Road</p>', city: 'Kochi', state: 'Kerala', pincode: '1' } },
      { documentId: 'duplicate', workflowStatus: 'Scheduled', customerEmail: 'duplicate@example.com',
        requestedDate: '2026-10-01', selectedTimeSlot: '10:00 AM', reminderSentForDate: '2026-10-01' },
      { documentId: 'cancelled', workflowStatus: 'Cancelled', customerEmail: 'cancelled@example.com',
        requestedDate: '2026-10-01', selectedTimeSlot: '10:00 AM' },
      { documentId: 'invalid', workflowStatus: 'Scheduled', customerEmail: null,
        requestedDate: '2026-10-01', selectedTimeSlot: '10:00 AM' },
    ];
    const strapi = { log: { info() {}, error() {} }, plugin: () => ({ service: () => ({ send: async mail => sent.push(mail) }) }),
      documents: () => ({ findMany: async () => appointments, update: async request => updates.push(request) }) };
    const result = await run(strapi, '2026-09-30');
    assert.deepEqual(result, { appointmentDate: '2026-10-01', sent: 1 });
    assert.equal(sent.length, 1);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].documentId, 'send');
    assert.equal(updates[0].data.reminderSentForDate, '2026-10-01');
  } finally {
    if (previous === undefined) delete process.env.APPOINTMENT_MANAGE_URL;
    else process.env.APPOINTMENT_MANAGE_URL = previous;
  }
});
