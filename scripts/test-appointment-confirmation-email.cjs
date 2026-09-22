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

const template = load('src/emails/appointment-confirmed.ts').appointmentConfirmedTemplate;
const { sendStoreVisitConfirmationEmail: send } = load('src/utils/appointment-confirmation-email.ts');
const data = {
  documentId: 'appointment & one', customerEmail: 'customer@example.com', customerName: '<Customer & Co>',
  requestedDate: '2099-10-05', selectedTimeSlot: '<11:00 AM>', location: '<Sunny & Kochi>',
};

function mailMock(fail = false) {
  const sent = [], errors = [];
  return { sent, errors, log: { info() {}, error: message => errors.push(message) },
    plugin: () => ({ service: () => ({ send: async message => {
      if (fail) throw new Error('secret-provider-details');
      sent.push(message);
    } }) }),
  };
}

test('confirmation template follows the requested copy and escapes dynamic HTML', () => {
  const message = template({ ...data, manageUrl: 'https://example.com/manage?a=1&b=2' });
  assert.equal(message.subject, 'Your Sunny Diamonds Appointment Is Confirmed – Oct 5, 2099');
  assert.match(message.text, /Date: Oct 5, 2099/);
  assert.match(message.html, /cid:sunny-diamonds-logo/);
  assert.match(message.html, /max-width:560px/);
  assert.match(message.html, /background:#0A0A0A;color:#FFFFFF/);
  assert.equal(message.attachments[0].cid, 'sunny-diamonds-logo');
  assert.ok(message.attachments[0].content.length > 0);
  assert.match(message.text, /Appointment Type: Showroom Visit/);
  assert.match(message.html, /&lt;Customer &amp; Co&gt;/);
  assert.match(message.html, /&lt;11:00 AM&gt;/);
  assert.match(message.html, /&lt;Sunny &amp; Kochi&gt;/);
  assert.match(message.html, /a=1&amp;b=2/);
  assert.ok(!message.html.includes('<Customer'));
});

test('delivery targets the customer and adds the document ID to the configured manage URL', async () => {
  const previous = process.env.APPOINTMENT_MANAGE_URL;
  process.env.APPOINTMENT_MANAGE_URL = 'https://sunnydiamonds.com/manage-appointment?source=email';
  try {
    const strapi = mailMock();
    await send(strapi, data);
    assert.equal(strapi.sent.length, 1);
    assert.equal(strapi.sent[0].to, data.customerEmail);
    assert.match(strapi.sent[0].html, /source=email&amp;documentId=appointment\+%26\+one/);
    for (const changes of [{ customerEmail: null }, { customerEmail: 'bad\r\nBcc:x@example.com' },
      { requestedDate: '2099-02-30' }, { selectedTimeSlot: '' }]) await send(strapi, { ...data, ...changes });
    assert.equal(strapi.sent.length, 1);
  } finally {
    if (previous === undefined) delete process.env.APPOINTMENT_MANAGE_URL;
    else process.env.APPOINTMENT_MANAGE_URL = previous;
  }
});

test('provider failures remain best-effort and do not leak provider details', async () => {
  const strapi = mailMock(true);
  await assert.doesNotReject(send(strapi, data));
  assert.equal(strapi.errors.length, 1);
  assert.ok(!strapi.errors[0].includes('secret-provider-details'));
});
