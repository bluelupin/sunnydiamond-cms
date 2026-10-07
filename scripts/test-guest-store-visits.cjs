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
const { normalizeAppointmentPhone } = load('src/utils/normalize-appointment-phone.ts');
const { linkGuestStoreVisits } = load('src/utils/link-guest-store-visits.ts', name =>
  name.endsWith('/normalize-appointment-phone') ? { normalizeAppointmentPhone } : require(name));
const policy = load('src/policies/trusted-magento-customer.ts', name =>
  name.endsWith('/normalize-appointment-phone') ? { normalizeAppointmentPhone } : require(name)).default;

test('links unowned store visits by phone first, falls back to email, and preserves ownership', async () => {
  const db = new DatabaseSync(':memory:');
  const builder = knex({ client: 'mysql2' });
  try {
    db.exec('CREATE TABLE product_submissions (id INTEGER PRIMARY KEY, form_tag TEXT, customer_email TEXT, magento_customer_id INTEGER, customer_phone TEXT)');
    const insert = db.prepare('INSERT INTO product_submissions (id, form_tag, customer_email, magento_customer_id) VALUES (?, ?, ?, ?)');
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
    let beforeUpdate;
    const strapi = { db: {
      metadata: { get: () => ({ tableName: 'product_submissions' }) },
      connection(table) {
        const query = builder(table);
        query.then = (resolve, reject) => {
          const { sql, bindings } = query.toSQL();
          return Promise.resolve(db.prepare(sql).all(...bindings)).then(resolve, reject);
        };
        const update = query.update.bind(query);
        query.update = data => {
          if (beforeUpdate) { const hook = beforeUpdate; beforeUpdate = undefined; hook(); }
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
    const insertPhone = db.prepare('INSERT INTO product_submissions VALUES (?, ?, ?, ?, ?)');
    insertPhone.run(10, 'store-visit', null, null, '9876543210');
    insertPhone.run(11, 'product-store-visit', 'different@example.com', null, '+91 98765-43210');
    insertPhone.run(12, 'store-visit', 'phone@example.com', null, '919876543210');
    insertPhone.run(13, 'store-visit', 'phone@example.com', null, '9123456789');
    insertPhone.run(14, 'store-visit', 'phone@example.com', 99, '9876543210');
    insertPhone.run(15, 'product-video-call', 'phone@example.com', null, '9876543210');
    insertPhone.run(16, 'store-visit', ' PHONE@example.com ', null, 'invalid');
    insertPhone.run(17, 'product-store-visit', 'phone@example.com', null, '');
    insertPhone.run(18, 'store-visit', null, null, '+1 (202) 555-0123');
    insertPhone.run(19, 'store-visit', 'phone@example.com', null, '+44 7700 900123');
    // Email alone cannot claim a booking with a usable phone.
    await linkGuestStoreVisits(strapi, { id: 8, email: 'phone@example.com' });
    assert.deepEqual(db.prepare('SELECT magento_customer_id FROM product_submissions WHERE id >= 10 ORDER BY id').all()
      .map(row => row.magento_customer_id), [null, null, null, null, 99, null, 8, 8, null, null]);
    // Verified phone wins even when the booking email is absent or different.
    await Promise.all([
      linkGuestStoreVisits(strapi, { id: 7, phone: '+919876543210', email: 'phone@example.com' }),
      linkGuestStoreVisits(strapi, { id: 9, phone: '9876543210' }),
    ]);
    const phoneOwners = db.prepare('SELECT magento_customer_id FROM product_submissions WHERE id BETWEEN 10 AND 12 ORDER BY id').all()
      .map(row => row.magento_customer_id);
    assert.ok(phoneOwners.every(owner => owner === 7 || owner === 9));
    assert.deepEqual(db.prepare('SELECT magento_customer_id FROM product_submissions WHERE id >= 13 ORDER BY id').all()
      .map(row => row.magento_customer_id), [null, 99, null, 8, 8, null, null]);
    const beforeRepeat = updates;
    await linkGuestStoreVisits(strapi, { id: 10, phone: '9876543210' });
    await linkGuestStoreVisits(strapi, { id: 10, phone: 'invalid' });
    assert.equal(updates, beforeRepeat);
    await linkGuestStoreVisits(strapi, { id: 7, phone: '+12025550123' });
    assert.equal(db.prepare('SELECT magento_customer_id FROM product_submissions WHERE id = 18').get().magento_customer_id, 7);
    assert.equal(db.prepare('SELECT customer_phone FROM product_submissions WHERE id = 11').get().customer_phone, '+91 98765-43210');
    // More than one batch of unowned candidates must not hide a later match.
    for (let id = 20; id < 280; id++) insertPhone.run(id, 'store-visit', null, null, '9123456789');
    insertPhone.run(280, 'store-visit', null, null, '9876543210');
    await linkGuestStoreVisits(strapi, { id: 7, phone: '9876543210' });
    assert.equal(db.prepare('SELECT magento_customer_id FROM product_submissions WHERE id = 280').get().magento_customer_id, 7);
    insertPhone.run(281, 'store-visit', null, null, '9876543210');
    beforeUpdate = () => db.prepare('UPDATE product_submissions SET customer_phone = ? WHERE id = 281').run('9123456789');
    await linkGuestStoreVisits(strapi, { id: 7, phone: '9876543210' });
    assert.equal(db.prepare('SELECT magento_customer_id FROM product_submissions WHERE id = 281').get().magento_customer_id, null);
    // Exercise the configured policy, real linking, and listing in the same request.
    const routes = load('src/api/product-submission/routes/product-submission-customer.ts').default.routes;
    const listRoute = routes.find(route => route.path === '/customer/appointments');
    const openRoute = routes.find(route => route.path === '/customer/appointments/open');
    const rowsFor = customerId => db.prepare('SELECT * FROM product_submissions WHERE magento_customer_id = ? ORDER BY id DESC').all(customerId);
    strapi.db.query = () => ({ findMany: async ({ where, limit }) => rowsFor(where.magentoCustomerId).slice(0, limit).map(row => ({
      documentId: String(row.id), formTag: row.form_tag, requestedDate: '2099-01-01', selectedTimeSlot: '10:00',
    })) });
    const controller = load('src/api/product-submission/controllers/product-submission.ts', name => {
      if (name === '@strapi/strapi') return { factories: { createCoreController: (_, factory) => factory({ strapi }) } };
      if (name.endsWith('/link-guest-store-visits')) return { linkGuestStoreVisits };
      if (name.endsWith('/generic-appointments')) return { linkGuestGenericAppointments: async () => {} };
      if (name.endsWith('/list-customer-appointments')) return { listCustomerAppointments: async (_, options) => {
        const rows = rowsFor(options.customerId);
        return { data: rows.slice((options.page - 1) * options.pageSize, options.page * options.pageSize)
          .map(row => ({ documentId: String(row.id) })),
          meta: { pagination: { page: options.page, pageSize: options.pageSize, total: rows.length } } };
      } };
      if (name.endsWith('/request-locale')) return { requestLocale: () => 'en' };
      if (name.endsWith('/appointment-schedule')) return { RESCHEDULABLE_FORM_TAGS: [],
        appointmentToday: () => '2026-01-01', appointmentStartsAt: () => new Date('2099-01-01') };
      return {};
    }).default;
    // Phone signup: newest blank-email booking must appear on the first fetch.
    insertPhone.run(282, 'store-visit', null, null, '+91 87654-32109');
    const phoneSignup = context({ magentoCustomerId: 20, magentoCustomerPhone: '+918765432109', page: '1', pageSize: '1' });
    phoneSignup.query = phoneSignup.request.query;
    await policy(phoneSignup, listRoute.config.policies[0].config);
    const firstPage = await controller.customerAppointments(phoneSignup);
    assert.deepEqual(firstPage.data, [{ documentId: '282' }]);
    assert.equal(firstPage.meta.pagination.total, 1);
    // Email signup alone does not claim the phone booking; subsequent verification does.
    insertPhone.run(283, 'product-store-visit', null, null, '7654321098');
    insertPhone.run(284, 'store-visit', null, null, '7654321098');
    const emailSignup = context({ magentoCustomerId: 21, magentoCustomerEmail: 'new@example.com', page: '2', pageSize: '1' });
    emailSignup.query = emailSignup.request.query;
    await policy(emailSignup, listRoute.config.policies[0].config);
    assert.deepEqual((await controller.customerAppointments(emailSignup)).data, []);
    emailSignup.request.query.magentoCustomerPhone = '+917654321098';
    await policy(emailSignup, listRoute.config.policies[0].config);
    const secondPage = await controller.customerAppointments(emailSignup);
    assert.deepEqual(secondPage.data, [{ documentId: '283' }]);
    assert.equal(secondPage.meta.pagination.total, 2);
    // Open appointments also claims bookings before applying its limit.
    insertPhone.run(285, 'store-visit', null, null, '6543210987');
    const openSignup = context({ magentoCustomerId: 22, magentoCustomerPhone: '+916543210987' });
    await policy(openSignup, openRoute.config.policies[0].config);
    assert.equal((await controller.openAppointments(openSignup)).data[0].documentId, '285');
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
  const identity = { id: 7, email: 'person@example.com', phone: '+919876543210' };
  const strapi = { db: { query: () => ({ findMany: async ({ where }) => {
    assert.ok(where.formTag.$in.includes('store-visit')); calls.push('open'); return [];
  } }) } };
  const controller = load('src/api/product-submission/controllers/product-submission.ts', name => {
    if (name === '@strapi/strapi') return { factories: { createCoreController: (_, factory) => factory({ strapi }) } };
    if (name.endsWith('/generic-appointments')) return { linkGuestGenericAppointments: async (_, customer) => {
      assert.deepEqual(customer, identity); await Promise.resolve(); calls.push('generic-link');
    } };
    if (name.endsWith('/link-guest-store-visits')) return { linkGuestStoreVisits: async (_, customer) => {
      assert.deepEqual(customer, identity); await Promise.resolve(); calls.push('link');
    } };
    if (name.endsWith('/list-customer-appointments')) return { listCustomerAppointments: async (_, options) => {
      calls.push('list'); assert.equal(options.customerId, 7); assert.equal(options.page, 2); assert.equal(options.pageSize, 10);
      assert.ok(options.formTags.includes('store-visit')); return { data: [], meta: {} };
    } };
    if (name.endsWith('/request-locale')) return { requestLocale: () => 'en' };
    if (name.endsWith('/appointment-schedule')) return { RESCHEDULABLE_FORM_TAGS: [], appointmentToday: () => '2026-01-01' };
    return {};
  }).default;
  const ctx = { state: { magentoCustomer: identity }, query: { page: '2', pageSize: '10' } };
  await controller.customerAppointments(ctx);
  await controller.openAppointments(ctx);
  assert.deepEqual(calls, ['link', 'generic-link', 'list', 'link', 'open']);
});

test('store visit email is optional for guests and signed-in customers; supplied emails are validated', async () => {
  let formLookups = 0;
  const strapi = { documents: () => ({ findFirst: async () => { formLookups++; return null; } }) };
  const controller = load('src/api/product-submission/controllers/product-submission.ts', name => {
    if (name === '@strapi/strapi') return { factories: { createCoreController: (_, factory) => factory({ strapi }) } };
    if (name.endsWith('/appointment-schedule')) return { RESCHEDULABLE_FORM_TAGS: [] };
    if (name.endsWith('/request-locale')) return { requestLocale: () => 'en' };
    if (name.endsWith('/form-submission-rate-limit')) return {
      checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => '127.0.0.1',
    };
    return {};
  }).default;
  for (const formTag of ['store-visit', 'product-store-visit']) {
    for (const state of [{}, { magentoCustomer: { id: 7 } }]) {
      for (const customerEmail of [undefined, null, '', '   ', 'guest@example.com', 'invalid']) {
        const before = formLookups;
        const result = await controller.submit({
          state, request: { body: { data: {
            formTag, customerName: 'Customer', customerPhone: '9876543210', customerEmail,
          } } }, badRequest: message => ({ message }),
        });
        // A missing form deliberately stops submission after contact validation.
        assert.equal(result.message, customerEmail === 'invalid'
          ? 'customerEmail must be a valid email address.' : 'Unknown formTag.');
        assert.equal(formLookups - before, customerEmail === 'invalid' ? 0 : 1);
      }
    }
  }
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    '../src/api/product-submission/content-types/product-submission/schema.json'), 'utf8'));
  assert.notEqual(schema.attributes.customerEmail.required, true);
});

test('personalisation submissions queue Getting in touch after saving, without appointment SMS', async () => {
  const events = [];
  const strapi = {
    documents: uid => uid.includes('product-form')
      ? { findFirst: async () => ({ showroomOptions: [] }) }
      : { create: async ({ data }) => { events.push('save'); return { ...data, id: 1, documentId: 'personalisation' }; } },
    db: { transaction: async callback => callback({ trx: {} }) },
  };
  const controller = load('src/api/product-submission/controllers/product-submission.ts', name => {
    if (name === '@strapi/strapi') return { factories: { createCoreController: (_, factory) => factory({ strapi }) } };
    if (name.endsWith('/request-locale')) return { requestLocale: () => 'en' };
    if (name.endsWith('/appointment-schedule')) return { RESCHEDULABLE_FORM_TAGS: [] };
    if (name.endsWith('/home-trial-group-key')) return { GROUPED_APPOINTMENT_FORM_TAGS: [] };
    if (name.endsWith('/form-submission-rate-limit')) return {
      checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => '127.0.0.1',
    };
    if (name.endsWith('/appointment-request-sms')) return { queueAppointmentRequestSms: async () => assert.fail('Unexpected appointment SMS') };
    if (name.endsWith('/enquiry-sms')) return { queueEnquirySms: async (_, data, type) => {
      assert.deepEqual(data, { documentId: 'personalisation', phone: '9876543210' });
      assert.equal(type, 'enquiryReceived');
      events.push('sms');
    } };
    if (name.endsWith('/product-personalisation-confirmation-email')) return { sendProductPersonalisationConfirmationEmail: async () => events.push('email') };
    return {};
  }).default;
  const result = await controller.submit({ state: {}, request: { body: { data: {
    formTag: 'product-personalisation', productName: 'Ring', customerName: 'Customer', customerPhone: '9876543210',
  } } }, badRequest: message => { throw new Error(message); } });
  assert.equal(result.data.documentId, 'personalisation');
  assert.deepEqual(events, ['save', 'sms', 'email']);
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
    if (name.endsWith('/home-trial-group-key')) return { GROUPED_APPOINTMENT_FORM_TAGS: [] };
    if (name.endsWith('/form-submission-rate-limit')) return {
      checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => '127.0.0.1',
    };
    if (name.endsWith('/store-visit-clash')) return { storeVisitClash: async () => false };
    if (name.endsWith('/appointment-reference')) return { assignAppointmentReference: async () => 'SV-1' };
    if (name.endsWith('/appointment-request-sms')) return { queueAppointmentRequestSms: async (_, data) => {
      assert.deepEqual(data, { documentId: 'booking', phone: '9876543210' });
      assert.ok(saved);
    } };
    if (name.endsWith('/appointment-confirmation-email')) return { sendStoreVisitConfirmationEmail: async (_, data) => confirmations.push(data) };
    return {};
  }).default;
  const input = {
    formTag: 'product-store-visit', productName: 'Store visit', customerName: 'Guest',
    customerPhone: '9876543210', customerEmail: 'guest@example.com', preferredShowroom: 'showroom',
    purposeOfVisit: ' Bridal jewellery ', requestDetails: 'Looking for an engagement ring',
  };
  const ctx = value => ({ state: {}, request: { body: { data: value } }, badRequest: message => ({ message }) });
  for (const formTag of ['store-visit', 'product-store-visit']) {
    for (const state of [{}, { magentoCustomer: { id: 7 } }]) {
      for (const customerEmail of [undefined, null, '', '   ']) {
        const request = ctx({ ...input, formTag, customerEmail });
        request.state = state;
        const result = await controller.submit(request);
        assert.equal(result.data.documentId, 'booking');
        assert.equal(saved.customerEmail, undefined);
        assert.equal(saved.magentoCustomerId, state.magentoCustomer?.id);
      }
    }
  }
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


test('appointment phone normalization preserves country codes and rejects ambiguous input', () => {
  for (const phone of ['9876543210', '09876543210', '919876543210', '+91 98765-43210', '(+91) 9876543210', '0091 9876543210']) {
    // A plus must precede the number, rather than appear inside parentheses.
    assert.equal(normalizeAppointmentPhone(phone), phone.startsWith('(') ? undefined : '+919876543210');
  }
  for (const [phone, expected] of [['+1 (202) 555-0123', '+12025550123'], ['0044 7700 900123', '+447700900123'], ['+971 50 123 4567', '+971501234567']]) {
    assert.equal(normalizeAppointmentPhone(phone), expected);
  }
  for (const phone of [undefined, null, 9876543210, ['9876543210'], '', ' ', '123', '1234567890', '447700900123', '+91 1234567890', '+91 987654321', '+0123456789', '+1234567890123456', '9876543210 ext 1', '++919876543210']) {
    assert.equal(normalizeAppointmentPhone(phone), undefined);
  }
});

test('verified phone identity requires configured routes and server authentication', async () => {
  const query = { magentoCustomerId: 7, magentoCustomerPhone: '+91 98765-43210' };
  const ctx = context(query);
  await policy(ctx, { acceptVerifiedPhone: true });
  assert.deepEqual(ctx.state.magentoCustomer, { id: 7, phone: '+919876543210' });
  await policy(ctx);
  assert.deepEqual(ctx.state.magentoCustomer, { id: 7 });
  await assert.rejects(policy(context(query, false), { acceptVerifiedPhone: true }));
  for (const phone of ['', null, 'invalid', ['9876543210'], 9876543210, '447700900123']) {
    await assert.rejects(policy(context({ magentoCustomerId: 7, magentoCustomerPhone: phone }), { acceptVerifiedPhone: true }));
  }
  const oldClient = context({ magentoCustomerId: 7 });
  await policy(oldClient, { acceptVerifiedPhone: true });
  assert.deepEqual(oldClient.state.magentoCustomer, { id: 7 });
  const both = context({ ...query, magentoCustomerEmail: ' Person@Example.com ' });
  await policy(both, { acceptVerifiedPhone: true, acceptVerifiedEmail: true });
  assert.deepEqual(both.state.magentoCustomer, { id: 7, email: 'person@example.com', phone: '+919876543210' });
  for (const data of [{ magentoCustomerId: 7, magentoCustomerPhone: '9876543210' }, { data: { magentoCustomerId: 7, magentoCustomerPhone: '9876543210' } }, { data: JSON.stringify({ magentoCustomerId: 7, magentoCustomerPhone: '9876543210' }) }]) {
    const post = context({ magentoCustomerPhone: '+12025550123' });
    post.request.method = 'POST';
    post.request.body = data;
    await policy(post, { acceptVerifiedPhone: true });
    assert.deepEqual(post.state.magentoCustomer, { id: 7, phone: '+919876543210' });
  }
  const guest = context(query);
  guest.request.method = 'POST';
  guest.request.body = { data: { formTag: 'store-visit', magentoCustomerPhone: '9876543210' } };
  await policy(guest, { allowGuestFormTags: ['store-visit'], acceptVerifiedPhone: true });
  assert.equal(guest.state.magentoCustomer, undefined);
});
