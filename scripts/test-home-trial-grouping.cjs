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
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')))
    : require(name), module, module.exports);
  return module.exports;
}
const { createHomeTrialSubmission: submit } = load('src/utils/create-home-trial-submission.ts');
const { homeTrialScheduleKey: key, legacyHomeTrialScheduleKey: legacyKey } = load('src/utils/home-trial-group-key.ts');
const input = { magentoCustomerId: 7, formTag: 'try-at-home', requestedDate: '2099-10-01',
  selectedTimeSlot: '10:00 AM', addressLine1: '12 Main Road', addressLine2: 'Flat 2',
  city: 'Kochi', pincode: '682001', state: 'state-1' };
function harness() {
  const groups = [], products = [];
  const strapi = {
    db: {
      metadata: { get: () => ({ tableName: 'groups' }) },
      transaction: async run => run({ trx: {} }),
      connection: () => {
        let keys;
        const chain = { transacting: () => chain, whereIn: (_, values) => { keys = values; return chain; },
          orderBy: () => chain, forUpdate: async () => groups.filter(g => keys.includes(g.activeScheduleKey))
            .map(g => ({ document_id: g.documentId, active_schedule_key: g.activeScheduleKey })) };
        return chain;
      },
      query: () => ({ findOne: async ({ where }) => products.find(p => p.appointmentGroup === where.appointmentGroup.documentId) }),
    },
    documents: uid => {
      const rows = uid.includes('appointment-group') ? groups : products;
      return {
        findOne: async ({ documentId }) => {
          const row = rows.find(r => r.documentId === documentId);
          return row && { ...row, state: row.state ? { documentId: row.state } : null };
        },
        create: async ({ data }) => {
          const row = { ...data, id: rows.length + 1, documentId: `${uid}-${rows.length + 1}` };
          rows.push(row); return row;
        },
        update: async ({ documentId, data }) => Object.assign(rows.find(r => r.documentId === documentId), data),
      };
    },
  };
  return { strapi, groups, products };
}
test('matching addresses join; every different address field creates a separate group', async () => {
  const { strapi, groups } = harness();
  const first = await submit(strapi, input);
  const same = await submit(strapi, { ...input, addressLine1: '  12  MAIN road ', city: 'KOCHI' });
  assert.equal(same.groupDocumentId, first.groupDocumentId);
  assert.match(first.appointmentReference, /^TAH-\d{4}-\d{6}$/);
  assert.equal(first.entity.appointmentReference, first.appointmentReference);
  assert.equal(same.entity.appointmentReference, first.appointmentReference);
  assert.equal(same.entity.appointmentReference, same.appointmentReference);
  for (const field of ['addressLine1', 'addressLine2', 'city', 'pincode', 'state']) {
    const different = await submit(strapi, { ...input, [field]: 'different' });
    assert.notEqual(different.groupDocumentId, first.groupDocumentId, field);
    assert.equal(different.entity[field], 'different');
  }
  assert.equal(groups.length, 6);
});
test('existing schedule-only groups are reused only for the same saved address', async () => {
  const { strapi, groups } = harness();
  const first = await submit(strapi, input);
  groups[0].activeScheduleKey = legacyKey(7, input.requestedDate, input.selectedTimeSlot);
  const different = await submit(strapi, { ...input, addressLine1: 'Other Road' });
  assert.notEqual(different.groupDocumentId, first.groupDocumentId);
  const same = await submit(strapi, input);
  assert.equal(same.groupDocumentId, first.groupDocumentId);
  assert.equal(groups[0].activeScheduleKey, key(7, input.requestedDate, input.selectedTimeSlot, input));
});
test('customer and schedule still separate groups, and missing optional lines equal blank lines', async () => {
  const { strapi } = harness();
  const first = await submit(strapi, { ...input, addressLine2: undefined });
  assert.equal((await submit(strapi, { ...input, addressLine2: ' ' })).groupDocumentId, first.groupDocumentId);
  for (const change of [{ magentoCustomerId: 8 }, { requestedDate: '2099-10-02' }, { selectedTimeSlot: '11:00 AM' }]) {
    assert.notEqual((await submit(strapi, { ...input, addressLine2: undefined, ...change })).groupDocumentId, first.groupDocumentId);
  }
});
