const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, stubs = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (!name.startsWith('.')) return require(name);
    return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), stubs);
  }, module, module.exports);
  return module.exports;
}
const template = load('src/emails/appointment-rescheduled.ts').appointmentRescheduledTemplate;
const { sendAppointmentRescheduleEmail: send, notifyRescheduleAfterCommit: notify, registerAdminRescheduleEmail } =
  load('src/utils/appointment-reschedule-email.ts');
const data = {
  documentId: 'appointment-1', customerEmail: 'customer@example.com', customerName: '<Customer & Co>',
  previousDate: '2099-10-01', previousTimeSlot: '10:00 AM', requestedDate: '2099-10-05', selectedTimeSlot: '11:00 AM',
};
const flush = () => new Promise(resolve => setImmediate(resolve));
function mailMock(fail = false) {
  const sent = [], errors = [];
  return { sent, errors, log: { info() {}, error: message => errors.push(message) },
    plugin: () => ({ service: () => ({ send: async message => {
      if (fail) throw new Error('secret-provider-details');
      sent.push(message);
    } }) }),
  };
}
test('template includes both schedules and escapes all dynamic HTML values', () => {
  const message = template({ ...data, documentId: '<reference>', selectedTimeSlot: '<slot>' });
  assert.match(message.text, /Oct 1, 2099/);
  assert.match(message.text, /Oct 5, 2099/);
  assert.match(message.html, /&lt;Customer &amp; Co&gt;/);
  assert.match(message.html, /&lt;reference&gt;/);
  assert.match(message.html, /&lt;slot&gt;/);
  assert.ok(!message.html.includes('<Customer'));
});
test('email uses configured Strapi provider and rejects invalid or missing recipients/schedules', async () => {
  const strapi = mailMock();
  await send(strapi, data);
  assert.equal(strapi.sent[0].to, data.customerEmail);
  assert.equal(strapi.sent[0].from, undefined); // provider supplies configured identity
  for (const changes of [{ customerEmail: null }, { customerEmail: 'a@example.com,b@example.com' },
    { customerEmail: 'bad\r\nBcc: victim@example.com' }, { requestedDate: '2099-02-30' }, { selectedTimeSlot: '' },
    { requestedDate: data.previousDate, selectedTimeSlot: data.previousTimeSlot }]) {
    await send(strapi, { ...data, ...changes });
  }
  assert.equal(strapi.sent.length, 1);
});
test('delivery waits for commit, and failure does not escape the notification helper', async () => {
  const strapi = mailMock();
  const callbacks = [];
  notify(strapi, callback => callbacks.push(callback), data);
  assert.equal(strapi.sent.length, 0);
  callbacks.pop(); // rollback discards the registered notification
  assert.equal(strapi.sent.length, 0);
  notify(strapi, callback => callbacks.push(callback), data);
  callbacks.pop()();
  await flush();
  assert.equal(strapi.sent.length, 1);
  const failing = mailMock(true);
  await assert.doesNotReject(send(failing, data));
  assert.equal(failing.errors.length, 1);
  assert.ok(!failing.errors[0].includes('secret-provider-details'));
});

function transactionHarness(strapi, rollback = false) {
  let callbacks = [];
  const chain = new Proxy({}, { get: (_, key) => key === 'then' ? undefined : () => chain });
  strapi.db = {
    metadata: { get: () => ({ tableName: 'appointments' }) }, connection: () => chain,
    transaction: async run => {
      const pending = [];
      const result = await run({ trx: {}, onCommit: callback => pending.push(callback) });
      if (rollback) throw new Error('simulated rollback');
      callbacks.push(...pending);
      return result;
    },
  };
  return { callbacks, commit: async () => { for (const callback of callbacks.splice(0)) callback(); await flush(); } };
}

test('group reschedule registers exactly one email after updating multiple products', async () => {
  for (const scenario of ['reschedule', 'unchanged', 'notes', 'cancel', 'rollback', 'merge']) {
    const strapi = mailMock();
    const harness = transactionHarness(strapi, scenario === 'rollback');
    const rows = [1, 2].map(id => ({ id, documentId: `product-${id}`, magentoCustomerId: 7,
      formTag: 'try-at-home', customerEmail: data.customerEmail, customerName: data.customerName,
      workflowStatus: 'Scheduled', appointmentGroup: { documentId: 'group-1' } }));
    const group = { documentId: 'group-1', magentoCustomerId: 7, workflowStatus: 'Scheduled',
      requestedDate: data.previousDate, selectedTimeSlot: data.previousTimeSlot };
    const target = { ...group, documentId: 'group-2', requestedDate: data.requestedDate, selectedTimeSlot: data.selectedTimeSlot,
      activeScheduleKey: require('node:crypto').createHash('sha256')
        .update(JSON.stringify([7, data.requestedDate, data.selectedTimeSlot])).digest('hex') };
    const updates = [];
    strapi.db.query = () => ({ findOne: async () => rows[0], findMany: async () => rows });
    strapi.documents = uid => ({
      findOne: async ({ documentId }) => documentId === 'group-2' ? target : group,
      findFirst: async () => uid.includes('product-form') ? {} : scenario === 'merge' ? target : undefined,
      update: async request => { updates.push({ uid, ...request }); return request.data; }, create: async () => ({}),
    });
    const { mutateHomeTrialGroup } = load('src/utils/mutate-home-trial-group.ts', {
      './create-home-trial-submission': { retryableGroupRace: () => false },
      './appointment-schedule': { validateAppointmentSchedule: () => undefined, validateReschedulingWindow: () => undefined,
        validAppointmentDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value) },
    });
    const same = ['unchanged', 'notes'].includes(scenario);
    const request = { documentId: 'product-1', customerId: 7, action: scenario === 'cancel' ? 'cancel' : 'reschedule',
      requestedDate: same ? data.previousDate : data.requestedDate,
      selectedTimeSlot: same ? data.previousTimeSlot : data.selectedTimeSlot,
      noteChanges: scenario === 'notes' ? { requestDetails: 'updated note' } : {},
    };
    if (scenario === 'rollback') await assert.rejects(mutateHomeTrialGroup(strapi, request), /rollback/);
    else await mutateHomeTrialGroup(strapi, request);
    assert.equal(strapi.sent.length, 0, scenario);
    const shouldSend = ['reschedule', 'merge'].includes(scenario);
    assert.equal(harness.callbacks.length, shouldSend ? 1 : 0, scenario);
    await harness.commit();
    assert.equal(strapi.sent.length, shouldSend ? 1 : 0, scenario);
    if (shouldSend) assert.equal(updates.filter(update => update.uid.includes('product-submission')).length, 2);
  }
});

test('CMS schedule save sends only after commit; API requests and cancelled appointments are excluded', async () => {
  for (const scenario of ['changed', 'unchanged', 'cancelled', 'api', 'failure']) {
    const strapi = mailMock();
    const harness = transactionHarness(strapi);
    let middleware, reads = 0;
    strapi.documents = { use: fn => { middleware = fn; } };
    strapi.requestContext = { get: () => ({ state: { user: { id: 1 } }, request: {
      url: scenario === 'api' ? '/api/product-submissions/reschedule' : '/content-manager/collection-types/product',
    } }) };
    strapi.db.query = () => ({ findOne: async () => ({ ...data, formTag: 'product-store-visit',
      requestedDate: reads++ === 0 || scenario === 'unchanged' ? data.previousDate : data.requestedDate,
      workflowStatus: scenario === 'cancelled' ? 'Cancelled' : 'Scheduled',
    }) });
    registerAdminRescheduleEmail(strapi);
    const run = () => middleware({ uid: 'api::product-submission.product-submission', action: 'update',
      params: { documentId: data.documentId } }, async () => {
      if (scenario === 'failure') throw new Error('save failed');
      return {};
    });
    if (scenario === 'failure') await assert.rejects(run(), /save failed/);
    else await run();
    assert.equal(strapi.sent.length, 0);
    await harness.commit();
    assert.equal(strapi.sent.length, scenario === 'changed' ? 1 : 0, scenario);
  }
});

test('single-appointment API queues only committed schedule changes and uses updated contact details', async () => {
  for (const scenario of ['changed', 'unchanged', 'contact', 'invalid', 'rollback']) {
    const strapi = mailMock();
    const harness = transactionHarness(strapi, scenario === 'rollback');
    const appointment = { ...data, id: 1, formTag: 'product-store-visit', workflowStatus: 'Scheduled',
      requestedDate: data.previousDate, selectedTimeSlot: data.previousTimeSlot };
    const chain = new Proxy({}, { get: (_, key) => key === 'then' ? undefined
      : key === 'first' ? async () => ({ id: 1 }) : () => chain });
    strapi.db.connection = () => chain;
    strapi.db.query = () => ({ findOne: async () => appointment });
    strapi.documents = () => ({ findFirst: async () => ({}), update: async () => ({}) });
    const prefix = '../../../utils/';
    const controller = load('src/api/product-submission/controllers/product-submission.ts', {
      '@strapi/strapi': { factories: { createCoreController: (_uid, factory) => factory({ strapi }) } },
      [prefix + 'form-submission-rate-limit']: { checkFormSubmissionRateLimit: () => ({ allowed: true }) },
      [prefix + 'request-locale']: { requestLocale: () => 'en' },
      [prefix + 'appointment-schedule']: { RESCHEDULABLE_FORM_TAGS: [], validateReschedulingWindow: () => undefined,
        validateAppointmentSchedule: () => scenario === 'invalid' ? 'Invalid schedule' : undefined },
      [prefix + 'create-home-trial-submission']: {},
      [prefix + 'mutate-home-trial-group']: {},
      [prefix + 'list-customer-appointments']: {},
    }).default;
    const same = ['unchanged', 'contact'].includes(scenario);
    const ctx = {
      params: { documentId: data.documentId }, state: {}, ip: '127.0.0.1',
      request: { body: {
        requestedDate: same ? data.previousDate : data.requestedDate,
        selectedTimeSlot: same ? data.previousTimeSlot : data.selectedTimeSlot,
        ...(scenario === 'unchanged' ? {} : { customerEmail: 'updated@example.com' }),
      } },
      badRequest: message => ({ error: message }),
    };
    if (scenario === 'rollback') await assert.rejects(controller.reschedule(ctx), /rollback/);
    else await controller.reschedule(ctx);
    assert.equal(strapi.sent.length, 0);
    await harness.commit();
    assert.equal(strapi.sent.length, scenario === 'changed' ? 1 : 0, scenario);
    if (scenario === 'changed') assert.equal(strapi.sent[0].to, 'updated@example.com');
  }
});
