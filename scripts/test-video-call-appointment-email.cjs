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

const templates = load('src/emails/video-call-appointment.ts');
const email = load('src/utils/video-call-appointment-email.ts');
const reminders = load('src/utils/video-call-appointment-reminder.ts');
const data = { documentId: 'video-1', appointmentReference: 'VC-2099-000001', customerName: '<Customer & Co>',
  customerEmail: 'customer@example.com', requestedDate: '2099-10-05', selectedTimeSlot: '<11:00 AM>',
  productName: '<Diamond Ring>', sourcePage: 'https://example.com/video?a=1&b=2' };
const mock = appointments => {
  const sent = [], updates = [];
  return { sent, updates, log: { info() {}, error() {} }, plugin: () => ({ service: () => ({ send: async mail => sent.push(mail) }) }),
    documents: () => ({ findMany: async () => appointments || [], update: async request => updates.push(request) }) };
};

test('video call templates cover confirmation, reminder, reschedule and cancellation safely', () => {
  const common = { appointmentId: data.appointmentReference, customerName: data.customerName,
    appointmentDate: data.requestedDate, appointmentTime: data.selectedTimeSlot, productName: data.productName,
    manageUrl: 'https://example.com/manage?a=1&b=2', bookAppointmentUrl: data.sourcePage };
  for (const name of ['videoCallConfirmedTemplate', 'videoCallReminderTemplate', 'videoCallRescheduledTemplate', 'videoCallCancelledTemplate']) {
    const message = templates[name](common);
    assert.match(message.text, /Appointment Type: Video Call/);
    assert.match(message.html, /&lt;Customer &amp; Co&gt;/);
    assert.match(message.html, /&lt;Diamond Ring&gt;/);
    assert.ok(!message.html.includes('<Customer'));
  }
  assert.match(templates.videoCallCancelledTemplate(common).html, /Book a New Appointment/);
});

test('confirmation and cancellation send their dedicated templates', async () => {
  const previous = process.env.APPOINTMENT_MANAGE_URL;
  process.env.APPOINTMENT_MANAGE_URL = 'https://example.com/manage';
  try {
    const strapi = mock();
    await email.sendVideoCallConfirmationEmail(strapi, data);
    await email.sendVideoCallCancellationEmail(strapi, data);
    assert.equal(strapi.sent.length, 2);
    assert.match(strapi.sent[0].subject, /Video Call Appointment Is Confirmed/);
    assert.match(strapi.sent[1].html, /Book a New Appointment/);
  } finally {
    if (previous === undefined) delete process.env.APPOINTMENT_MANAGE_URL; else process.env.APPOINTMENT_MANAGE_URL = previous;
  }
});

test('daily video call reminder sends eligible appointments once', async () => {
  const appointments = [{ ...data, workflowStatus: 'Scheduled' },
    { ...data, documentId: 'duplicate', reminderSentForDate: '2099-10-05' },
    { ...data, documentId: 'cancelled', workflowStatus: 'Cancelled' }];
  const strapi = mock(appointments);
  const result = await reminders.sendTomorrowVideoCallAppointmentReminders(strapi, '2099-10-04');
  assert.deepEqual(result, { appointmentDate: '2099-10-05', sent: 1 });
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.updates.length, 1);
  assert.match(strapi.sent[0].subject, /Video Call Appointment Is Tomorrow/);
});
