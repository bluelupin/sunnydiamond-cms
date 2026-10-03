const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const knex = require('knex');
const { DatabaseSync } = require('node:sqlite');

function load(file, resolve = require) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
  return module.exports;
}
const { linkGuestStoreVisits } = load('src/utils/link-guest-store-visits.ts');
const policy = load('src/policies/trusted-magento-customer.ts').default;

test('links only matching unowned store visits, including historical email casing and spaces', async () => {
  const db = new DatabaseSync(':memory:');
  const builder = knex({ client: 'mysql2' });
  try {
    db.exec('CREATE TABLE product_submissions (id INTEGER PRIMARY KEY, form_tag TEXT, customer_email TEXT, magento_customer_id INTEGER)');
    const insert = db.prepare('INSERT INTO product_submissions VALUES (?, ?, ?, ?)');
    insert.run(1, 'product-store-visit', ' Person@Example.com ', null);
    insert.run(2, 'product-store-visit', 'other@example.com', null);
    insert.run(3, 'product-store-visit', 'person@example.com', 99);
    insert.run(4, 'product-video-call', 'person@example.com', null);
    insert.run(5, 'product-store-visit', null, null);
    insert.run(6, 'product-store-visit', 'person@example.com', null);
    insert.run(7, 'store-visit', ' PERSON@example.com ', null);
    insert.run(8, 'store-visit', 'other@example.com', null);
    insert.run(9, 'store-visit', 'person@example.com', 99);
    let updates = 0;
    const strapi = { db: {
      metadata: { get: () => ({ tableName: 'product_submissions' }) },
      connection(table) {
        const query = builder(table);
        const update = query.update.bind(query);
        query.update = data => {
          const { sql, bindings } = update(data).toSQL();
          const result = db.prepare(sql).run(...bindings);
          updates += Number(result.changes);
          return Promise.resolve(result.changes);
        };
        return query;
      },
    } };
    await linkGuestStoreVisits(strapi, { id: 7, email: ' PERSON@example.com ' });
    assert.deepEqual(db.prepare('SELECT magento_customer_id FROM product_submissions ORDER BY id').all()
      .map(row => row.magento_customer_id), [7, null, 99, null, null, 7, 7, null, 99]);
    await Promise.all([
      linkGuestStoreVisits(strapi, { id: 7, email: 'person@example.com' }),
      linkGuestStoreVisits(strapi, { id: 8, email: 'person@example.com' }),
    ]);
    assert.equal(updates, 3);
    assert.equal(db.prepare('SELECT magento_customer_id FROM product_submissions WHERE id = 1').get().magento_customer_id, 7);
    await linkGuestStoreVisits(strapi, { id: 7 });
    assert.equal(updates, 3);
  } finally { db.close(); await builder.destroy(); }
});

function context(query = {}, authenticated = true) {
  return { state: { auth: { strategy: { name: authenticated ? 'content-api-token' : 'users-permissions' } } },
    request: { method: 'GET', query, body: {} } };
}

test('verified email is accepted only on configured routes with server authentication', async () => {
  const ctx = context({ magentoCustomerId: '7', magentoCustomerEmail: ' Person@Example.com ' });
  await policy(ctx, { acceptVerifiedEmail: true });
  assert.deepEqual(ctx.state.magentoCustomer, { id: 7, email: 'person@example.com' });
  await policy(ctx);
  assert.deepEqual(ctx.state.magentoCustomer, { id: 7 });
  await assert.rejects(policy(context(ctx.request.query, false), { acceptVerifiedEmail: true }));
  for (const email of ['', 'invalid', ['person@example.com']]) {
    await assert.rejects(policy(context({ magentoCustomerId: 7, magentoCustomerEmail: email }), { acceptVerifiedEmail: true }));
  }
  const oldClient = context({ magentoCustomerId: 7 });
  await policy(oldClient, { acceptVerifiedEmail: true });
  assert.deepEqual(oldClient.state.magentoCustomer, { id: 7 });
});

test('guest store booking remains allowed without customer identity', async () => {
  const route = load('src/api/product-submission/routes/product-submission-submit.ts').default.routes[0];
  const config = route.config.policies[0].config;
  const ctx = context();
  ctx.request.method = 'POST';
  ctx.request.body = { data: { formTag: 'product-store-visit' } };
  assert.equal(await policy(ctx, { allowGuestFormTags: ['product-store-visit'] }), true);
  assert.equal(ctx.state.magentoCustomer, undefined);
  ctx.request.body = { data: { formTag: 'store-visit' } };
  assert.equal(await policy(ctx, config), true);
  assert.equal(ctx.state.magentoCustomer, undefined);
  await assert.rejects(policy(ctx));
});

test('both list controllers await linking; pagination is applied afterwards', async () => {
  const calls = [];
  const identity = { id: 7, email: 'person@example.com' };
  const strapi = { db: { query: () => ({ findMany: async ({ where }) => {
    assert.ok(where.formTag.$in.includes('store-visit')); calls.push('open'); return [];
  } }) } };
  const controller = load('src/api/product-submission/controllers/product-submission.ts', name => {
    if (name === '@strapi/strapi') return { factories: { createCoreController: (_, factory) => factory({ strapi }) } };
    if (name.endsWith('/link-guest-store-visits')) return { linkGuestStoreVisits: async (_, customer) => {
      assert.deepEqual(customer, identity); await Promise.resolve(); calls.push('link');
    } };
    if (name.endsWith('/list-customer-appointments')) return { listCustomerAppointments: async (_, options) => {
      calls.push('list'); assert.equal(options.customerId, 7); assert.equal(options.page, 2);
      assert.ok(options.formTags.includes('store-visit')); return { data: [], meta: {} };
    } };
    if (name.endsWith('/request-locale')) return { requestLocale: () => 'en' };
    if (name.endsWith('/appointment-schedule')) return { RESCHEDULABLE_FORM_TAGS: [], appointmentToday: () => '2026-01-01' };
    return {};
  }).default;
  const ctx = { state: { magentoCustomer: identity }, query: { page: '2', pageSize: '10' } };
  await controller.customerAppointments(ctx);
  await controller.openAppointments(ctx);
  assert.deepEqual(calls, ['link', 'list', 'link', 'open']);
});

test('store visit submission requires email before saving the booking', async () => {
  const controller = load('src/api/product-submission/controllers/product-submission.ts', name => {
    if (name === '@strapi/strapi') return { factories: { createCoreController: (_, factory) => factory({ strapi: {} }) } };
    if (name.endsWith('/request-locale')) return { requestLocale: () => 'en' };
    if (name.endsWith('/appointment-schedule')) return { RESCHEDULABLE_FORM_TAGS: [] };
    if (name.endsWith('/form-submission-rate-limit')) return {
      checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => '127.0.0.1',
    };
    return {};
  }).default;
  const result = await controller.submit({
    state: {}, request: { body: { data: {
      formTag: 'product-store-visit', productName: 'Store visit', customerName: 'Guest', customerPhone: '9876543210',
    } } }, badRequest: message => ({ message }),
  });
  assert.equal(result.message, 'customerEmail is required for store visits.');
});

test('store visit submission saves purposeOfVisit separately from requestDetails', async () => {
  let saved;
  const confirmations = [];
  const strapi = {
    documents: uid => uid.includes('product-form') ? { findFirst: async () => ({ showroomOptions: [] }) }
      : uid.includes('showroom') ? { findFirst: async () => ({ documentId: 'showroom', city: 'Kochi' }) }
      : { create: async ({ data }) => { saved = data; return { ...data, id: 1, documentId: 'booking' }; } },
    db: { transaction: async callback => callback({ trx: {} }) },
  };
  const controller = load('src/api/product-submission/controllers/product-submission.ts', name => {
    if (name === '@strapi/strapi') return { factories: { createCoreController: (_, factory) => factory({ strapi }) } };
    if (name.endsWith('/request-locale')) return { requestLocale: () => 'en' };
    if (name.endsWith('/appointment-schedule')) return { RESCHEDULABLE_FORM_TAGS: [] };
    if (name.endsWith('/home-trial-group-key')) return { HOME_TRIAL_FORM_TAGS: [] };
    if (name.endsWith('/form-submission-rate-limit')) return {
      checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => '127.0.0.1',
    };
    if (name.endsWith('/store-visit-clash')) return { storeVisitClash: async () => false };
    if (name.endsWith('/appointment-reference')) return { assignAppointmentReference: async () => 'SV-1' };
    if (name.endsWith('/appointment-confirmation-email')) return { sendStoreVisitConfirmationEmail: async (_, data) => confirmations.push(data) };
    return {};
  }).default;
  const input = {
    formTag: 'product-store-visit', productName: 'Store visit', customerName: 'Guest',
    customerPhone: '9876543210', customerEmail: 'guest@example.com', preferredShowroom: 'showroom',
    purposeOfVisit: ' Bridal jewellery ', requestDetails: 'Looking for an engagement ring',
  };
  const ctx = value => ({ state: {}, request: { body: { data: value } }, badRequest: message => ({ message }) });
  await controller.submit(ctx(input));
  assert.equal(saved.purposeOfVisit, 'Bridal jewellery');
  assert.equal(saved.requestDetails, input.requestDetails);
  assert.equal((await controller.submit(ctx({ ...input, purposeOfVisit: {} }))).message,
    'purposeOfVisit must be text.');
  const longPurpose = 'a'.repeat(1000);
  await controller.submit(ctx({ ...input, purposeOfVisit: longPurpose }));
  assert.equal(saved.purposeOfVisit, longPurpose);
  await controller.submit(ctx({ ...input, purposeOfVisit: undefined }));
  assert.equal(saved.purposeOfVisit, undefined);
  for (const productName of [undefined, '', '   ']) {
    const result = await controller.submit(ctx({ ...input, productName }));
    assert.equal(result.data.documentId, 'booking');
    assert.equal(saved.productName, undefined);
  }
  for (const productName of [undefined, '', '   ']) {
    const confirmationCount = confirmations.length;
    const result = await controller.submit(ctx({ ...input, formTag: 'store-visit', productName }));
    assert.equal(result.data.documentId, 'booking');
    assert.equal(saved.formTag, 'store-visit');
    assert.equal(saved.productName, undefined);
    assert.equal(result.data.appointmentId, 'SV-1');
    assert.equal(confirmations.length, confirmationCount + 1);
    assert.equal(confirmations.at(-1).customerEmail, input.customerEmail);
    assert.equal(confirmations.at(-1).appointmentReference, 'SV-1');
    assert.equal(confirmations.at(-1).location, 'Kochi');
  }
  for (const formTag of ['product-video-call', 'product-personalisation', 'try-at-home', 'try-at-home-form']) {
    const result = await controller.submit(ctx({ ...input, formTag, productName: undefined }));
    assert.equal(result.message, 'productName is required.');
  }
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    '../src/api/product-submission/content-types/product-submission/schema.json'), 'utf8'));
  assert.notEqual(schema.attributes.productName.required, true);
});
