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

test('standard create and submit endpoints save generic bookings and send confirmations', async () => {
  let created;
  const emails = [];
  const form = { requiresConsent: true, dynamicFields: [{ label: 'Your Name', isRequired: true },
    { label: 'Phone No.', isRequired: true }, { label: 'Email', isRequired: true }, { label: 'Date', isRequired: true },
    { label: 'Time Slots', fieldType: 'dropdown', isRequired: true, dropdownOptions: [{ optionValue: '11:00 AM' }] },
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
  ctx.request.body = { ...input, showroom: undefined, consentAccepted: false };
  assert.ok((await controller.create(ctx)).data.documentId);
  assert.equal(created.preferredShowroom, undefined);
  assert.equal(created.consentAccepted, false);
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
