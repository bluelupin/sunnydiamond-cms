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

const template = load('src/emails/showroom-appointment-rescheduled.ts').showroomAppointmentRescheduledTemplate;
const { sendAppointmentRescheduleEmail: send } = load('src/utils/appointment-reschedule-email.ts');

function mailMock() {
  const sent = [];
  return { sent, log: { info() {}, error() {} }, plugin: () => ({ service: () => ({ send: async message => sent.push(message) }) }) };
}

test('showroom reschedule template follows supplied copy and escapes dynamic values', () => {
  const message = template({ appointmentId: '<id>', customerName: '<Customer & Co>', newDate: '2099-10-06',
    newTime: '<11:00 AM>', showroomName: '<Kochi>', showroomAddress: 'MG Road & South',
    manageUrl: 'https://example.com/manage?a=1&b=2' });
  assert.equal(message.subject, 'Your Sunny Diamonds Appointment Has Been Rescheduled');
  assert.match(message.text, /Appointment Type: Showroom Visit/);
  assert.match(message.html, /&lt;Customer &amp; Co&gt;/);
  assert.match(message.html, /a=1&amp;b=2/);
  assert.ok(!message.html.includes('<Customer'));
});

test('product-store-visit dispatches the showroom template with location and manage link', async () => {
  const previous = process.env.APPOINTMENT_MANAGE_URL;
  process.env.APPOINTMENT_MANAGE_URL = 'https://example.com/manage';
  try {
    const strapi = mailMock();
    await send(strapi, { documentId: 'appointment-1', formTag: 'product-store-visit', customerName: 'Customer',
      customerEmail: 'customer@example.com', previousDate: '2099-10-05', previousTimeSlot: '10:00 AM',
      requestedDate: '2099-10-06', selectedTimeSlot: '11:00 AM',
      preferredShowroom: { address: '<p>MG Road</p>', city: 'Kochi', state: 'Kerala', pincode: '123456' } });
    assert.equal(strapi.sent.length, 1);
    assert.equal(strapi.sent[0].subject, 'Your Sunny Diamonds Appointment Has Been Rescheduled');
    assert.match(strapi.sent[0].text, /Location: MG Road, Kochi, Kerala, 123456/);
    assert.match(strapi.sent[0].html, /documentId=appointment-1/);
    assert.doesNotMatch(strapi.sent[0].text, /Previous date/);
  } finally {
    if (previous === undefined) delete process.env.APPOINTMENT_MANAGE_URL;
    else process.env.APPOINTMENT_MANAGE_URL = previous;
  }
});
