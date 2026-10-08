const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (mocks[name]) return mocks[name];
    if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), `${name}.ts`)), mocks);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

test('appointment changes create linked cancellation and reschedule logs', async () => {
  const { recordVideoCallChange } = load('src/utils/video-call-change-log.ts');
  const logs = [];
  const strapi = { documents: () => ({ create: async entry => logs.push(entry.data) }) };
  const before = { documentId: 'booking', formTag: 'book-an-appointment', workflowStatus: 'New', preferredDate: '2099-12-01', selectedTimeSlot: '11:00 AM' };
  await recordVideoCallChange(strapi, before, { ...before, preferredDate: '2099-12-02' }, 'Customer');
  await recordVideoCallChange(strapi, before, { ...before, workflowStatus: 'Cancelled' }, 'Admin');
  await recordVideoCallChange(strapi, before, before, 'Customer');
  assert.deepEqual(logs.map(log => log.eventType), ['Rescheduled', 'Cancelled']);
  assert.deepEqual(logs[0].affectedGenericSubmissions, { connect: ['booking'] });
  assert.equal(logs[1].actorType, 'Admin');
});

test('generic time dropdown options validate bookings while unrelated dropdown values do not', () => {
  const { validateGenericAppointmentSchedule: validate } = load('src/utils/generic-appointment-schedule.ts');
  const form = { dynamicFields: [
    { label: 'Preferred Time Slot', fieldType: 'dropdown', dropdownOptions: [{ optionValue: '10:00 AM - 11:00 AM' }] },
    { label: 'Purpose of Visit', fieldType: 'dropdown', dropdownOptions: [{ optionValue: 'Consultation' }] },
  ] };
  assert.equal(validate('2099-10-08', '10:00 AM - 11:00 AM', form), undefined);
  assert.match(validate('2099-10-08', 'Consultation', form), /available time slot/);
  assert.match(validate('2099-10-08', '11:00 AM - 12:00 PM', form), /available time slot/);
  assert.match(validate('2099-02-30', '10:00 AM - 11:00 AM', form), /valid date/);
  assert.match(validate('2099-10-08', '10:00 AM - 11:00 AM', {
    ...form, availableTimeSlots: [{ timeString: '12:00 PM - 1:00 PM' }],
  }), /available time slot/);
});

test('customer-facing required field labels map to the generic submission keys', () => {
  const { fieldValue } = load('src/utils/generic-form-input.ts');
  const input = { fullName: 'Customer', phone: '+919555000000', email: 'customer@example.com' };
  assert.equal(fieldValue(input, 'Your Name'), 'fullName');
  assert.equal(fieldValue(input, ' Your   Full Name '), 'fullName');
  assert.equal(fieldValue(input, 'Your Phone Number'), 'phone');
  assert.equal(fieldValue(input, 'Your Email Address'), 'email');
  assert.equal(fieldValue({ fullName: '   ' }, 'Your Name'), undefined);
  assert.equal(fieldValue({ 'Custom Field': 'value' }, 'Custom Field'), 'Custom Field');
});

test('generic slots accept equivalent hour formatting but still reject different or invalid times', () => {
  const { validateGenericAppointmentSchedule: validate, resolveGenericAppointmentSlot: resolve } = load('src/utils/generic-appointment-schedule.ts');
  const form = { availableTimeSlots: [{ timeString: '12:00 PM - 1:00 PM' }] };
  for (const value of ['12:00 PM - 01:00 PM', '12:00 pm–01:00 pm']) {
    assert.equal(validate('2099-12-01', value, form), undefined);
    assert.equal(resolve(value, form), '12:00 PM - 1:00 PM');
  }
  for (const value of ['12:00 PM - 2:00 PM', '12:00 AM - 01:00 PM', '12:00 PM - 13:00 PM']) {
    assert.match(validate('2099-12-01', value, form), /available time slot/);
  }
});

test('all general appointment email templates omit showroom wording without a selected showroom', () => {
  const cases = [
    ['appointment-confirmed', 'appointmentConfirmedTemplate', { documentId: 'booking', requestedDate: '2099-12-01', selectedTimeSlot: '11:00 AM', location: '' }],
    ['showroom-appointment-rescheduled', 'showroomAppointmentRescheduledTemplate', { appointmentId: 'BA-2099-000001', newDate: '2099-12-01', newTime: '11:00 AM' }],
    ['showroom-appointment-cancelled', 'showroomAppointmentCancelledTemplate', { appointmentId: 'BA-2099-000001', appointmentDate: '2099-12-01', appointmentTime: '11:00 AM' }],
    ['showroom-appointment-reminder', 'showroomAppointmentReminderTemplate', { appointmentDate: '2099-12-01', appointmentTime: '11:00 AM' }],
  ];
  for (const [file, fn, data] of cases) {
    const message = load(`src/emails/${file}.ts`)[fn]({ ...data, generalAppointment: true });
    assert.ok(!/showroom/i.test(message.subject + message.text + message.html), file);
    assert.ok(!/Not specified/.test(message.text), file);
    assert.match(message.html, /cid:sunny-diamonds-logo/);
  }
});

test('standard create and submit endpoints save generic bookings and send confirmations', async () => {
  let created;
  const emails = [];
  const sms = [];
  const form = { requiresConsent: true, dynamicFields: [{ label: 'Your Name', isRequired: true },
    { label: 'Phone No.', isRequired: true }, { label: 'Email', isRequired: true }, { label: 'Date', isRequired: true },
    { label: 'Time Slots', fieldType: 'dropdown', isRequired: true, dropdownOptions: [{ optionValue: '11:00 AM' }, { optionValue: '12:00 PM - 1:00 PM' }] },
    { label: 'Describe more about your visit', isRequired: true }],
    showrooms: [{ documentId: 'showroom' }] };
  const strapi = { documents: uid => {
    assert.ok(['api::generic-form.generic-form', 'api::showroom.showroom', 'api::generic-submission.generic-submission'].includes(uid));
    return {
      findFirst: async () => uid.includes('generic-form') ? form : { documentId: 'showroom', address: 'Main Road', city: 'Kochi' },
      create: async ({ data }) => {
        assert.equal(uid, 'api::generic-submission.generic-submission');
        created = data;
        return { ...data, id: 1, documentId: 'booking' };
      },
      update: async ({ data }) => { assert.match(data.appointmentReference, /^BA-/); },
    };
  } };
  const controller = load('src/api/generic-submission/controllers/generic-submission.ts', {
    '@strapi/strapi': { factories: { createCoreController: (_uid, factory) => factory({ strapi }) } },
    '../../../utils/reach-out-confirmation-email': {},
    '../../../utils/appointment-request-sms': { queueAppointmentRequestSms: async (_, data) => {
      assert.ok(created, 'Save the appointment before queuing SMS');
      sms.push(data);
    } },
    '../../../utils/appointment-confirmation-email': { sendBookAppointmentConfirmationEmail: async (_strapi, data) => {
      assert.ok(created, 'The enquiry must be saved before sending its confirmation');
      emails.push(data);
    } },
    '../../../utils/form-submission-rate-limit': { checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => 'test' },
    '../../../utils/request-locale': { requestLocale: () => 'en' },
  }).default;
  const input = { formTag: 'book-an-appointment', fullName: 'Customer', phone: '9999999999', email: 'a@example.com',
    preferredDate: '2099-12-01', showroom: 'showroom', selectedTimeSlot: '11:00 AM', consentAccepted: true, magentoCustomerId: 99,
    notes: 'I want to book an appointment' };
  const ctx = { state: {}, request: { body: { data: input } }, badRequest: error => ({ error }) };
  const result = await controller.create(ctx);
  assert.match(result.data.appointmentId, /^BA-/);
  assert.equal(created.fullName, 'Customer');
  assert.equal(created.preferredDate, '2099-12-01');
  assert.equal(created.magentoCustomerId, undefined);
  assert.equal(emails.length, 1);
  assert.deepEqual(sms, [{ documentId: 'booking', phone: '9999999999' }]);
  assert.equal(emails[0].appointmentReference, result.data.appointmentId);
  assert.equal(emails[0].customerEmail, input.email);
  assert.equal(emails[0].requestedDate, input.preferredDate);
  assert.equal(emails[0].selectedTimeSlot, input.selectedTimeSlot);
  assert.equal(emails[0].location, 'Main Road, Kochi');
  ctx.state.magentoCustomer = { id: 42 };
  await controller.submit(ctx);
  assert.equal(created.magentoCustomerId, 42);
  ctx.request.body = { ...input, selectedTimeSlot: 'invalid' };
  assert.match((await controller.submit(ctx)).error, /available time slot/);
  ctx.request.body = { ...input, consentAccepted: false };
  assert.match((await controller.submit(ctx)).error, /consentAccepted/);
  assert.equal(emails.length, 2, 'Rejected submissions must not send confirmations');
  form.requiresConsent = false;
  ctx.request.body = { ...input, showroom: undefined, consentAccepted: false, selectedTimeSlot: '12:00 PM - 01:00 PM' };
  assert.ok((await controller.create(ctx)).data.documentId);
  assert.equal(created.preferredShowroom, undefined);
  assert.equal(created.consentAccepted, false);
  assert.equal(created.selectedTimeSlot, '12:00 PM - 1:00 PM');
  assert.equal(emails[2].selectedTimeSlot, '12:00 PM - 1:00 PM');
  assert.equal(emails.length, 3);
  ctx.request.body = { ...ctx.request.body, notes: '' };
  assert.equal((await controller.create(ctx)).error, 'Describe more about your visit is required.');
  assert.equal(emails.length, 3);
});

function mutationFixture(owner = 42) {
  const record = { id: 1, documentId: 'booking', formTag: 'book-an-appointment', magentoCustomerId: owner,
    fullName: 'Customer', preferredDate: '2099-12-01', selectedTimeSlot: '11:00 AM', workflowStatus: 'New', rescheduleHistory: [] };
  const logs = [];
  const callbacks = [];
  const strapi = { db: {
    metadata: { get: () => ({ tableName: 'generic_submissions' }) },
    connection: () => { const chain = { transacting: () => chain, where: () => chain,
      forUpdate: () => chain, first: async () => ({ id: 1 }) }; return chain; },
    transaction: async fn => fn({ trx: {}, onCommit: callback => callbacks.push(callback) }),
    query: uid => { assert.equal(uid, 'api::generic-submission.generic-submission'); return {
      findOne: async ({ where }) => where.magentoCustomerId === undefined || where.magentoCustomerId === owner ? { ...record } : null,
    }; },
  }, documents: uid => ({
    findFirst: async ({ populate }) => {
      assert.equal(populate.dynamicFields.populate.dropdownOptions, true);
      return { dynamicFields: [{ label: 'Preferred Time', fieldType: 'dropdown', dropdownOptions: [{ optionValue: '11:00 AM' }] }] };
    },
    update: async ({ data }) => { assert.equal(uid, 'api::generic-submission.generic-submission'); Object.assign(record, data); },
    create: async ({ data }) => { assert.equal(uid, 'api::appointment-change.appointment-change'); logs.push(data); },
  }) };
  const ctx = { params: { documentId: 'booking' }, state: { magentoCustomer: { id: 42 } }, request: { body: {} },
    badRequest: error => ({ error }), notFound: error => ({ error }) };
  return { strapi, ctx, record, logs, callbacks };
}

test('rescheduling stores the configured slot and formatting-only requests create no history or email', async () => {
  const { mutateGenericAppointment } = load('src/utils/generic-appointments.ts');
  const f = mutationFixture();
  const documents = f.strapi.documents;
  f.strapi.documents = uid => uid.includes('generic-form') ? { findFirst: async () => ({
    dynamicFields: [{ label: 'Time Slots', fieldType: 'dropdown', dropdownOptions: [{ optionValue: '12:00 PM - 1:00 PM' }] }],
  }) } : documents(uid);
  const result = await mutateGenericAppointment(f.strapi, f.ctx, 'reschedule', { requestedDate: '2099-12-02', selectedTimeSlot: '12:00 PM - 01:00 PM' });
  assert.equal(result.data.selectedTimeSlot, '12:00 PM - 1:00 PM');
  assert.equal(f.record.selectedTimeSlot, '12:00 PM - 1:00 PM');
  assert.equal(f.logs[0].newData.selectedTimeSlot, '12:00 PM - 1:00 PM');
  assert.equal((await mutateGenericAppointment(f.strapi, f.ctx, 'reschedule', { selectedTimeSlot: '12:00 PM - 01:00 PM' })).meta.changed, false);
  assert.equal(f.logs.length, 1);
  assert.equal(f.callbacks.length, 1);
  assert.equal(f.record.rescheduleHistory.length, 1);
});

test('customer change emails send after commit with generic contact, date and reference fields', async () => {
  const { mutateGenericAppointment } = load('src/utils/generic-appointments.ts');
  const f = mutationFixture();
  const emails = [];
  Object.assign(f.record, { email: 'customer@example.com', appointmentReference: 'BA-2099-000001',
    preferredShowroom: { city: 'Kochi', address: 'Main Road' } });
  f.strapi.log = { info() {}, error() {} };
  f.strapi.plugin = () => ({ service: () => ({ send: async mail => emails.push(mail) }) });
  await mutateGenericAppointment(f.strapi, f.ctx, 'reschedule', { requestedDate: '2099-12-02' });
  assert.equal(emails.length, 0);
  assert.equal(f.callbacks.length, 1);
  f.callbacks.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'customer@example.com');
  assert.match(emails[0].text, /BA-2099-000001/);
  assert.match(emails[0].text, /Dec 2, 2099/);
  await mutateGenericAppointment(f.strapi, f.ctx, 'cancel');
  f.callbacks.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(emails.length, 2);
  assert.match(emails[1].subject, /cancelled/i);
  assert.match(emails[1].text, /Kochi/);
  await mutateGenericAppointment(f.strapi, f.ctx, 'cancel');
  assert.equal(f.callbacks.length, 0);
});

test('admin changes queue emails once and ignore unrelated or unchanged enquiries', async () => {
  const { registerGenericAppointmentHistory } = load('src/utils/generic-appointments.ts');
  const f = mutationFixture();
  let middleware;
  f.strapi.documents.use = fn => { middleware = fn; };
  f.strapi.requestContext = { get: () => ({ state: { user: { id: 1 } }, request: { url: '/content-manager/collection-types/' } }) };
  registerGenericAppointmentHistory(f.strapi);
  const context = { uid: 'api::generic-submission.generic-submission', action: 'update', params: { documentId: 'booking' } };
  await middleware(context, async () => { f.record.preferredDate = '2099-12-03'; });
  assert.equal(f.callbacks.length, 1);
  await middleware(context, async () => {});
  assert.equal(f.callbacks.length, 1);
  await middleware(context, async () => { f.record.workflowStatus = 'Cancelled'; });
  assert.equal(f.callbacks.length, 2);
  await middleware(context, async () => {});
  assert.equal(f.callbacks.length, 2);
  f.record.formTag = 'reach-out-to-us';
  await middleware(context, async () => { f.record.preferredDate = '2099-12-04'; });
  assert.equal(f.callbacks.length, 2);
});

test('generic reminders mark successful deliveries, skip completed bookings and retry failed sends', async () => {
  const { sendTomorrowGenericAppointmentReminders } = load('src/utils/generic-appointment-reminder.ts');
  const base = { formTag: 'book-an-appointment', fullName: 'Customer', email: 'customer@example.com',
    preferredDate: '2099-12-02', selectedTimeSlot: '11:00 AM', workflowStatus: 'New', preferredShowroom: { city: 'Kochi' } };
  const rows = [{ ...base, documentId: 'success' }, { ...base, documentId: 'failed', email: 'failed@example.com' },
    ...['Cancelled', 'Closed', 'Visited'].map(workflowStatus => ({ ...base, workflowStatus, documentId: workflowStatus })),
    { ...base, documentId: 'already-sent', reminderSentForDate: base.preferredDate }];
  const sent = [], errors = [];
  let failed = true;
  const strapi = { log: { info() {}, error: message => errors.push(message) },
    plugin: () => ({ service: () => ({ send: async mail => {
      if (failed && mail.to === 'failed@example.com') throw new Error('provider-secret');
      sent.push(mail);
    } }) }), documents: uid => {
      assert.equal(uid, 'api::generic-submission.generic-submission');
      return { findMany: async ({ filters }) => {
        assert.equal(filters.formTag, 'book-an-appointment');
        assert.equal(filters.preferredDate, base.preferredDate);
        return rows;
      }, update: async ({ documentId, data }) => Object.assign(rows.find(row => row.documentId === documentId), data) };
    } };
  assert.equal((await sendTomorrowGenericAppointmentReminders(strapi, '2099-12-01')).sent, 1);
  assert.equal(rows[0].reminderSentForDate, base.preferredDate);
  assert.equal(rows[1].reminderSentForDate, undefined);
  assert.equal(errors.length, 1);
  assert.ok(!errors[0].includes('provider-secret'));
  failed = false;
  assert.equal((await sendTomorrowGenericAppointmentReminders(strapi, '2099-12-01')).sent, 1);
  assert.equal((await sendTomorrowGenericAppointmentReminders(strapi, '2099-12-01')).sent, 0);
  assert.equal(sent.length, 2);
  assert.match(sent[0].subject, /Tomorrow/);
  assert.match(sent[0].text, /Kochi/);
});

test('rescheduling and cancellation update only the generic record and create linked logs', async () => {
  const { mutateGenericAppointment } = load('src/utils/generic-appointments.ts');
  const { strapi, ctx, record, logs } = mutationFixture();
  const result = await mutateGenericAppointment(strapi, ctx, 'reschedule', { requestedDate: '2099-12-02' });
  assert.equal(result.data.requestedDate, '2099-12-02');
  assert.equal(result.data.rescheduleCount, 1);
  assert.equal(record.preferredDate, '2099-12-02');
  assert.equal((await mutateGenericAppointment(strapi, ctx, 'cancel')).data.workflowStatus, 'Cancelled');
  assert.deepEqual(logs.map(log => log.eventType), ['Rescheduled', 'Cancelled']);
  assert.deepEqual(logs[0].affectedGenericSubmissions, { connect: ['booking'] });
  assert.equal((await mutateGenericAppointment(strapi, ctx, 'cancel')).meta.changed, false);
  assert.equal(logs.length, 2);
});

test('generic mutations reject other owners, invalid slots and exhausted reschedule allowances', async () => {
  const { mutateGenericAppointment } = load('src/utils/generic-appointments.ts');
  const other = mutationFixture(99);
  assert.equal(await mutateGenericAppointment(other.strapi, other.ctx, 'cancel'), undefined);
  const f = mutationFixture();
  assert.match((await mutateGenericAppointment(f.strapi, f.ctx, 'reschedule', { selectedTimeSlot: 'invalid' })).error, /available time slot/);
  f.record.rescheduleHistory = [1, 2].map(() => ({ previousData: { requestedDate: '2099-11-01' }, newData: { requestedDate: '2099-12-01' } }));
  assert.match((await mutateGenericAppointment(f.strapi, f.ctx, 'reschedule', { requestedDate: '2099-12-02' })).error, /twice/);
  assert.equal(f.logs.length, 0);
});

test('customer listing merges generic appointments and products before pagination', async () => {
  const { listCustomerAppointments } = load('src/utils/list-customer-appointments.ts');
  const generic = { documentId: 'generic', formTag: 'book-an-appointment', fullName: 'Customer', preferredDate: '2099-12-01',
    createdAt: '2026-10-05T12:00:00Z', workflowStatus: 'New' };
  const product = { id: 1, documentId: 'product', formTag: 'store-visit', createdAt: '2026-10-04T12:00:00Z' };
  const strapi = { db: { query: uid => ({
    count: async () => uid.includes('appointment-group') ? 0 : 1,
    findMany: async () => uid.includes('generic-submission') ? [generic] : uid.includes('product-submission') ? [product] : [],
  }) } };
  const options = { customerId: 42, page: 1, pageSize: 1, formTags: ['store-visit', 'book-an-appointment'] };
  const first = await listCustomerAppointments(strapi, options);
  assert.equal(first.data[0].documentId, 'generic');
  assert.deepEqual(first.data[0].products, []);
  assert.equal(first.meta.pagination.total, 2);
  assert.equal((await listCustomerAppointments(strapi, { ...options, page: 2 })).data[0].documentId, 'product');
});


test('guest and owned bookings accept blank email despite required CMS email fields', async () => {
  let saved;
  const form = { dynamicFields: [{ label: 'Your Email Address*', fieldType: 'email', isRequired: true }],
    availableTimeSlots: [{ timeString: '11:00 AM - 12:00 PM' }] };
  const strapi = { documents: uid => uid.includes('generic-form') ? { findFirst: async () => form }
    : { create: async ({ data }) => { saved = data; return { ...data, id: 1, documentId: 'booking' }; } } };
  const controller = load('src/api/generic-submission/controllers/generic-submission.ts', {
    '@strapi/strapi': { factories: { createCoreController: (_, factory) => factory({ strapi }) } },
    '../../../utils/form-submission-rate-limit': { checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => '127.0.0.1' },
    '../../../utils/appointment-reference': { assignAppointmentReference: async () => 'BA-1' },
    '../../../utils/appointment-confirmation-email': { sendBookAppointmentConfirmationEmail: async () => {} },
    '../../../utils/appointment-request-sms': { queueAppointmentRequestSms: async () => {} },
  }).default;
  const context = (email, owner) => ({ state: owner ? { magentoCustomer: { id: owner } } : {}, request: { body: { data: {
    formTag: 'book-an-appointment', fullName: 'Guest Customer', phone: '+1 202 555 0123', email,
    preferredDate: '2099-12-01', selectedTimeSlot: '11:00 AM - 12:00 PM', magentoCustomerId: 99,
  } } }, badRequest: error => ({ error }) });
  for (const owner of [undefined, 7]) for (const email of [undefined, null, '', '   ']) {
    assert.equal((await controller.submit(context(email, owner))).data.appointmentId, 'BA-1');
    assert.equal(saved.email, undefined);
    assert.equal(saved.phone, '+12025550123');
    assert.equal(saved.magentoCustomerId, owner);
  }
  assert.match((await controller.submit(context('invalid'))).error, /valid email/);
  const missingPhone = context(undefined); missingPhone.request.body.data.phone = '';
  assert.match((await controller.submit(missingPhone)).error, /valid phone/);
  const badSlot = context(undefined); badSlot.request.body.data.selectedTimeSlot = 'invalid';
  assert.match((await controller.submit(badSlot)).error, /available time slot/);
  form.dynamicFields.push({ label: 'Custom Field', isRequired: true });
  assert.equal((await controller.submit(context(undefined))).error, 'Custom Field is required.');
});

test('trusted appointment submission route accepts guests and rejects unauthenticated identity assertions', async () => {
  const route = load('src/api/generic-submission/routes/generic-submission-submit.ts').default.routes[0];
  const config = route.config.policies[0].config;
  const policy = load('src/policies/trusted-magento-customer.ts').default;
  const ctx = { state: { auth: { strategy: { name: 'content-api-token' } } },
    request: { method: 'POST', body: { data: { formTag: 'book-an-appointment' } } } };
  assert.equal(await policy(ctx, config), true);
  assert.equal(ctx.state.magentoCustomer, undefined);
  ctx.request.body.data.magentoCustomerId = 7;
  await policy(ctx, config); assert.equal(ctx.state.magentoCustomer.id, 7);
  ctx.state.auth.strategy.name = 'users-permissions';
  await assert.rejects(policy(ctx, config));
});

test('guest general appointments link by verified phone before listing and preserve ownership', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const knex = require('knex')({ client: 'mysql2' });
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE generic_submissions (id INTEGER PRIMARY KEY, form_tag TEXT, phone TEXT, email TEXT, magento_customer_id INTEGER)');
    const insert = db.prepare('INSERT INTO generic_submissions VALUES (?, ?, ?, ?, ?)');
    for (const row of [
      [1, 'book-an-appointment', '9876543210', null, null],
      [2, 'book-an-appointment', '+91 98765-43210', 'different@example.com', null],
      [3, 'book-an-appointment', '9123456789', 'person@example.com', null],
      [4, 'book-an-appointment', '9876543210', null, 99],
      [5, 'reach-out-to-us', '9876543210', 'person@example.com', null],
      [6, 'book-an-appointment', null, ' Person@Example.com ', null],
      [7, 'book-an-appointment', '+1 202 555 0123', null, null],
    ]) insert.run(...row);
    let beforeUpdate;
    const strapi = { db: { metadata: { get: () => ({ tableName: 'generic_submissions' }) }, connection(table) {
      const query = knex(table);
      query.then = (resolve, reject) => { const { sql, bindings } = query.toSQL(); return Promise.resolve(db.prepare(sql).all(...bindings)).then(resolve, reject); };
      const update = query.update.bind(query);
      query.update = data => {
        if (beforeUpdate) { const hook = beforeUpdate; beforeUpdate = undefined; hook(); }
        const { sql, bindings } = update(data).toSQL(); return Promise.resolve(db.prepare(sql).run(...bindings).changes);
      };
      return query;
    } } };
    const { linkGuestGenericAppointments: link } = load('src/utils/generic-appointments.ts');
    const owners = () => db.prepare('SELECT magento_customer_id FROM generic_submissions ORDER BY id').all().map(row => row.magento_customer_id);
    await link(strapi, { id: 7, email: 'person@example.com' });
    assert.deepEqual(owners(), [null, null, null, 99, null, 7, null]);
    await link(strapi, { id: 7, email: 'person@example.com', phone: '+919876543210' });
    assert.deepEqual(owners(), [7, 7, null, 99, null, 7, null]);
    await link(strapi, { id: 8, phone: '9876543210' });
    assert.deepEqual(owners(), [7, 7, null, 99, null, 7, null]);
    await link(strapi, { id: 7, phone: '+12025550123' });
    assert.equal(owners()[6], 7);
    insert.run(8, 'book-an-appointment', '8765432109', null, null);
    await Promise.all([link(strapi, { id: 7, phone: '8765432109' }), link(strapi, { id: 8, phone: '8765432109' })]);
    assert.ok([7, 8].includes(owners()[7]));
    insert.run(9, 'book-an-appointment', '7654321098', null, null);
    beforeUpdate = () => db.prepare('UPDATE generic_submissions SET phone = ? WHERE id = 9').run('6543210987');
    await link(strapi, { id: 7, phone: '7654321098' }); assert.equal(owners()[8], null);
    for(let id = 10; id < 270; id++) insert.run(id, 'book-an-appointment', '9123456789', null, null);
    insert.run(270, 'book-an-appointment', '7654321098', null, null);
    await link(strapi, { id: 7, phone: '7654321098' });
    assert.equal(db.prepare('SELECT magento_customer_id FROM generic_submissions WHERE id = 270').get().magento_customer_id, 7);
    // Run the real customer listing controller and merger after a newly verified phone.
    const { linkGuestGenericAppointments } = load('src/utils/generic-appointments.ts');
    const ownedRows = owner => db.prepare('SELECT * FROM generic_submissions WHERE magento_customer_id = ? ORDER BY id DESC').all(owner)
      .map(row => ({ id: row.id, documentId: String(row.id), formTag: row.form_tag, phone: row.phone, email: row.email,
        createdAt: '2099-01-01T00:00:00Z', preferredDate: '2099-12-01', workflowStatus: 'New' }));
    strapi.db.query = uid => ({
      count: async ({ where }) => uid.includes('generic-submission') ? ownedRows(where.magentoCustomerId).length : 0,
      findMany: async ({ where, limit }) => uid.includes('generic-submission') ? ownedRows(where.magentoCustomerId).slice(0, limit) : [],
    });
    const controller = load('src/api/product-submission/controllers/product-submission.ts', {
      '@strapi/strapi': { factories: { createCoreController: (_, factory) => factory({ strapi }) } },
      '../../../utils/link-guest-store-visits': { linkGuestStoreVisits: async () => {} },
      '../../../utils/generic-appointments': { linkGuestGenericAppointments },
    }).default;
    insert.run(271, 'book-an-appointment', '8765432190', null, null);
    insert.run(272, 'book-an-appointment', '8765432190', null, null);
    const ctx = { state: { magentoCustomer: { id: 20, email: 'signup@example.com' } }, query: { page: '2', pageSize: '1' } };
    assert.deepEqual((await controller.customerAppointments(ctx)).data, []);
    ctx.state.magentoCustomer.phone = '+918765432190';
    const listed = await controller.customerAppointments(ctx);
    assert.equal(listed.data[0].documentId, '271');
    assert.equal(listed.meta.pagination.total, 2);
  } finally { db.close(); await knex.destroy(); }
});

