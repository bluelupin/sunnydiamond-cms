const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts'))) : require(name), module, module.exports);
  return module.exports;
}
const { buildAppointmentReference, assignAppointmentReference, backfillAppointmentReferences, syncHomeTrialSubmissionReferences } = load('src/utils/appointment-reference.ts');

test('references are readable, stable, and based on creation year and persisted ID', () => {
  assert.equal(buildAppointmentReference('TAH', 1, '2026-07-25T10:00:00Z'), 'TAH-2026-000001');
  assert.equal(buildAppointmentReference('SV', 1234567, '2027-01-01T00:00:00Z'), 'SV-2027-1234567');
});

test('assign preserves an existing reference and otherwise persists the generated value', async () => {
  const updates = [];
  const strapi = { documents: () => ({ update: async value => updates.push(value) }) };
  assert.equal(await assignAppointmentReference(strapi, 'uid', { appointmentReference: 'TAH-2026-000009' }, 'TAH'), 'TAH-2026-000009');
  assert.equal(await assignAppointmentReference(strapi, 'uid', { id: 9, documentId: 'doc', createdAt: '2026-01-01' }, 'TAH'), 'TAH-2026-000009');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.appointmentReference, 'TAH-2026-000009');
});

test('backfill assigns prefixes to historical groups and showroom visits', async () => {
  const updates = [];
  const groups = [{ id: 2, documentId: 'group', createdAt: '2026-01-01' }];
  const visits = [{ id: 3, documentId: 'visit', createdAt: '2026-01-01' }];
  let query = 0;
  const strapi = { log: { info() {} }, db: { query: () => ({ findMany: async () => [groups, visits, []][query++] }) },
    documents: uid => ({ update: async value => updates.push({ uid, ...value }) }) };
  await backfillAppointmentReferences(strapi);
  assert.deepEqual(updates.map(value => value.data.appointmentReference), ['TAH-2026-000002', 'SV-2026-000003']);
});

test('repairs existing submissions from their group reference, including shared and incorrect IDs, idempotently', async () => {
  const appointmentGroup = { documentId: 'internal-group-id', appointmentReference: 'TAH-2026-000034' };
  const rows = [
    { id: 1, appointmentReference: null, appointmentGroup },
    { id: 2, appointmentReference: 'internal-group-id', appointmentGroup },
    { id: 3, appointmentReference: 'TAH-2026-000034', appointmentGroup },
    { id: 4, appointmentReference: 'legacy', appointmentGroup: null },
  ];
  const updates = [];
  const strapi = { db: { query: () => ({ findMany: async () => rows, update: async ({ where, data }) => {
    updates.push(data);
    Object.assign(rows.find(row => row.id === where.id), data);
  } }) } };
  await syncHomeTrialSubmissionReferences(strapi);
  assert.deepEqual(updates, [{ appointmentReference: 'TAH-2026-000034' }, { appointmentReference: 'TAH-2026-000034' }]);
  assert.equal(rows[3].appointmentReference, 'legacy');
  await syncHomeTrialSubmissionReferences(strapi);
  assert.equal(updates.length, 2);
});
