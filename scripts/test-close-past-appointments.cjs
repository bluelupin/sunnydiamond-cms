const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, stubs = {}) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (!name.startsWith('.')) return require(name);
    return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), stubs);
  }, module, module.exports);
  return module.exports;
}


const { closePastAppointments } = load('src/utils/close-past-appointments.ts', {
  './appointment-schedule': { appointmentToday: () => '2026-09-24',
    RESCHEDULABLE_FORM_TAGS: ['try-at-home', 'try-at-home-form', 'schedule-video-call', 'product-video-call'] },
});
const GROUP = 'api::appointment-group.appointment-group';
const PRODUCT = 'api::product-submission.product-submission';
function harness(groups = [], submissions = [], fail = false) {
  const rows = { [GROUP]: groups, [PRODUCT]: submissions };
  let inTransaction = false;
  const strapi = { log: { info() {} }, db: {
    transaction: async fn => {
      const snapshot = structuredClone(rows);
      inTransaction = true;
      try { return await fn(); }
      catch (error) { Object.assign(rows, snapshot); throw error; }
      finally { inTransaction = false; }
    },
    query: uid => ({ updateMany: async ({ where, data }) => {
      assert.ok(inTransaction);
      if (fail && uid === PRODUCT) throw new Error('Database failure');
      let count = 0;
      for (const row of rows[uid]) {
        const matches = Object.entries(where).every(([field, condition]) =>
          Object.entries(condition).every(([op, value]) => {
            if (op === '$lt') return row[field] != null && row[field] < value;
            if (op === '$in') return value.includes(row[field]);
            throw new Error('Unsupported operator: ' + op);
          }));
        if (matches) { Object.assign(row, data); count++; }
      }
      return { count };
    } }),
  } };
  return { rows, run: () => closePastAppointments(strapi) };
}
const row = (extra = {}) => ({ requestedDate: '2026-09-23', workflowStatus: 'New', formTag: 'product-store-visit', ...extra });

test('closes every appointment type, all active statuses, and more than one page of records', async () => {
  const submissions = Array.from({ length: 150 }, (_, i) => row({
    formTag: ['product-store-visit', 'product-video-call', 'schedule-video-call', 'try-at-home', 'try-at-home-form'][i % 5],
    workflowStatus: ['New', 'Contacted', 'Scheduled'][i % 3],
  }));
  const h = harness([row({ activeScheduleKey: 'occupied' })], submissions);
  assert.deepEqual(await h.run(), { groups: 1, submissions: 150 });
  assert.ok(submissions.every(item => item.workflowStatus === 'Closed' && item.updatedAt instanceof Date));
  assert.equal(h.rows[GROUP][0].activeScheduleKey, null);
  assert.deepEqual(await h.run(), { groups: 0, submissions: 0 });
});

test('preserves today, future, undated, cancelled, visited, closed and non-appointment submissions', async () => {
  const protectedRows = [row({ requestedDate: '2026-09-24' }), row({ requestedDate: '2026-09-25' }),
    row({ requestedDate: null }), row({ workflowStatus: 'Cancelled' }), row({ workflowStatus: 'Visited' }), row({ workflowStatus: 'Closed' })];
  const submissions = [...structuredClone(protectedRows), row({ formTag: 'product-personalisation' })];
  const h = harness(structuredClone(protectedRows), submissions);
  const before = structuredClone(h.rows);
  assert.deepEqual(await h.run(), { groups: 0, submissions: 0 });
  assert.deepEqual(h.rows, before);
});

test('failure propagates and the transaction rolls back group changes', async () => {
  const h = harness([row({ activeScheduleKey: 'occupied' })], [row()], true);
  const before = structuredClone(h.rows);
  await assert.rejects(h.run(), /Database failure/);
  assert.deepEqual(h.rows, before);
});

test('cron registers daily closure at 00:05 Asia/Kolkata', async () => {
  let calls = 0;
  const cron = load('config/cron-tasks.ts', {
    '../src/utils/close-past-appointments': { closePastAppointments: async () => { calls++; } },
    '../src/utils/showroom-appointment-reminder': {},
    '../src/utils/try-at-home-reminder': {},
    '../src/utils/video-call-appointment-reminder': {},
  }).default;
  assert.deepEqual(cron.closePastAppointments.options, { rule: '5 0 * * *', tz: 'Asia/Kolkata' });
  await cron.closePastAppointments.task({ strapi: {} });
  assert.equal(calls, 1);
  assert.ok(cron.showroomAppointmentReminder);
});
