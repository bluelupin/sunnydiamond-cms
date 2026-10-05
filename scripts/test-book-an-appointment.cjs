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

test('booking stays in General Enquiries and validates the configured generic form', async () => {
  let created;
  const form = { requiresConsent: true, dynamicFields: [{ label: 'Full Name', isRequired: true }],
    availableTimeSlots: [{ timeString: '11:00 AM' }], showrooms: [{ documentId: 'showroom' }] };
  const strapi = { documents: uid => {
    assert.ok(['api::generic-form.generic-form', 'api::showroom.showroom', 'api::generic-submission.generic-submission'].includes(uid));
    return {
      findFirst: async () => uid.includes('generic-form') ? form : { documentId: 'showroom' },
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
    '../../../utils/form-submission-rate-limit': { checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => 'test' },
    '../../../utils/request-locale': { requestLocale: () => 'en' },
  }).default;
  const input = { formTag: 'book-an-appointment', fullName: 'Customer', phone: '9999999999', email: 'a@example.com',
    preferredDate: '2099-12-01', showroom: 'showroom', selectedTimeSlot: '11:00 AM', consentAccepted: true, magentoCustomerId: 99 };
  const ctx = { state: {}, request: { body: { data: input } }, badRequest: error => ({ error }) };
  const result = await controller.submit(ctx);
  assert.match(result.data.appointmentId, /^BA-/);
  assert.equal(created.fullName, 'Customer');
  assert.equal(created.preferredDate, '2099-12-01');
  assert.equal(created.magentoCustomerId, undefined);
  ctx.state.magentoCustomer = { id: 42 };
  await controller.submit(ctx);
  assert.equal(created.magentoCustomerId, 42);
  ctx.request.body = { ...input, selectedTimeSlot: 'invalid' };
  assert.match((await controller.submit(ctx)).error, /available time slot/);
  ctx.request.body = { ...input, consentAccepted: false };
  assert.match((await controller.submit(ctx)).error, /consentAccepted/);
});

function mutationFixture(owner = 42) {
  const record = { id: 1, documentId: 'booking', formTag: 'book-an-appointment', magentoCustomerId: owner,
    fullName: 'Customer', preferredDate: '2099-12-01', selectedTimeSlot: '11:00 AM', workflowStatus: 'New', rescheduleHistory: [] };
  const logs = [];
  const strapi = { db: {
    metadata: { get: () => ({ tableName: 'generic_submissions' }) },
    connection: () => { const chain = { transacting: () => chain, where: () => chain,
      forUpdate: () => chain, first: async () => ({ id: 1 }) }; return chain; },
    transaction: async fn => fn({ trx: {} }),
    query: uid => { assert.equal(uid, 'api::generic-submission.generic-submission'); return {
      findOne: async ({ where }) => where.magentoCustomerId === owner ? { ...record } : null,
    }; },
  }, documents: uid => ({
    findFirst: async () => ({ availableTimeSlots: [{ timeString: '11:00 AM' }] }),
    update: async ({ data }) => { assert.equal(uid, 'api::generic-submission.generic-submission'); Object.assign(record, data); },
    create: async ({ data }) => { assert.equal(uid, 'api::appointment-change.appointment-change'); logs.push(data); },
  }) };
  const ctx = { params: { documentId: 'booking' }, state: { magentoCustomer: { id: 42 } }, request: { body: {} },
    badRequest: error => ({ error }), notFound: error => ({ error }) };
  return { strapi, ctx, record, logs };
}

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
