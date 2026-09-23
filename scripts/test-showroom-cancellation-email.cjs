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

const template = load('src/emails/showroom-appointment-cancelled.ts').showroomAppointmentCancelledTemplate;
const { sendShowroomAppointmentCancelledEmail: send, notifyShowroomCancellationAfterCommit: notify } =
  load('src/utils/showroom-appointment-cancelled-email.ts');
const data = {
  documentId: '<appointment-1>', customerName: '<Customer & Co>', customerEmail: 'customer@example.com',
  requestedDate: '2099-10-05', selectedTimeSlot: '<11:00 AM>', sourcePage: 'https://example.com/product?a=1&b=2',
  preferredShowroom: { city: '<Kochi>', state: 'Kerala & South', pincode: '123456', address: '<p>MG Road</p>' },
};

test('all cancellation emails resolve a relative product path using WEB_BASE_URL', async () => {
  const previous = process.env.WEB_BASE_URL;
  process.env.WEB_BASE_URL = 'https://shop.example.com/';
  try {
    const senders = [send,
      load('src/utils/video-call-appointment-email.ts').sendVideoCallCancellationEmail,
      load('src/utils/try-at-home-change-email.ts').sendTryAtHomeCancelledEmail];
    for (const sender of senders) {
      const strapi = mailMock();
      await sender(strapi, { ...data, productNames: ['Ring'], sourcePage: '/product/anya-diamond-finger-ring' });
      assert.equal(strapi.sent.length, 1);
      assert.match(strapi.sent[0].html, /href="https:\/\/shop.example.com\/product\/anya-diamond-finger-ring"/);
      assert.match(strapi.sent[0].text, /https:\/\/shop.example.com\/product\/anya-diamond-finger-ring/);
    }
    const { appointmentSourceUrl: resolve } = load('src/utils/appointment-source-url.ts');
    assert.equal(resolve('https://other.example.com/product'), 'https://other.example.com/product');
    assert.equal(resolve('/product?a=1&b=2#details'), 'https://shop.example.com/product?a=1&b=2#details');
    for (const value of ['', 'javascript:alert(1)', '//other.example.com', '/\\other.example.com']) {
      assert.equal(resolve(value), undefined);
    }
    delete process.env.WEB_BASE_URL;
    assert.equal(resolve('/product'), undefined);
    assert.equal(resolve('https://shop.example.com/product'), 'https://shop.example.com/product');
  } finally {
    if (previous === undefined) delete process.env.WEB_BASE_URL;
    else process.env.WEB_BASE_URL = previous;
  }
});

function mailMock(fail = false) {
  const sent = [], errors = [];
  return { sent, errors, log: { info() {}, error: message => errors.push(message) },
    plugin: () => ({ service: () => ({ send: async message => {
      if (fail) throw new Error('secret-provider-details');
      sent.push(message);
    } }) }),
  };
}

test('cancellation template contains all details and escapes dynamic HTML', () => {
  const message = template({ appointmentId: data.documentId, customerName: data.customerName,
    appointmentDate: data.requestedDate, appointmentTime: data.selectedTimeSlot,
    showroomName: data.preferredShowroom.city,
    showroomAddress: 'MG Road, Kerala & South', bookAppointmentUrl: data.sourcePage });
  assert.equal(message.subject, 'Your Sunny Diamonds Showroom Appointment Has Been Cancelled');
  assert.match(message.text, /Appointment ID: <appointment-1>/);
  assert.match(message.html, /&lt;Customer &amp; Co&gt;/);
  assert.match(message.html, /&lt;appointment-1&gt;/);
  assert.match(message.html, /a=1&amp;b=2/);
  assert.ok(!message.html.includes('<Customer'));
});

test('delivery builds showroom location and uses a safe source page booking link', async () => {
  const strapi = mailMock();
  await send(strapi, data);
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.sent[0].to, data.customerEmail);
  assert.match(strapi.sent[0].text, /Location: MG Road, <Kochi>, Kerala & South, 123456/);
  assert.match(strapi.sent[0].html, /Book a New Appointment/);
  await send(strapi, { ...data, customerEmail: 'bad\r\nBcc:x@example.com' });
  assert.equal(strapi.sent.length, 1);
});

test('notification waits for commit and provider failures remain best-effort', async () => {
  const strapi = mailMock();
  const callbacks = [];
  notify(strapi, callback => callbacks.push(callback), data);
  assert.equal(strapi.sent.length, 0);
  callbacks.pop()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(strapi.sent.length, 1);
  const failing = mailMock(true);
  await assert.doesNotReject(send(failing, data));
  assert.equal(failing.errors.length, 1);
  assert.ok(!failing.errors[0].includes('secret-provider-details'));
});
