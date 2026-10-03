const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const filename = path.resolve(__dirname, '../src/utils', `${name}.ts`);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.') ? load(name) : require(name), module, module.exports);
  return module.exports;
}
const { listCustomerAppointments } = load('list-customer-appointments');

test('listing exposes cancellation timestamps for groups and individuals only when cancelled', async () => {
  const changedAt = '2026-10-02T10:00:00.000Z';
  const groups = [{ id: 1, documentId: 'group', workflowStatus: 'Cancelled', createdAt: changedAt }];
  const products = [
    { id: 2, documentId: 'member', appointmentGroup: { documentId: 'group' }, createdAt: changedAt },
    { id: 3, documentId: 'individual', workflowStatus: 'Cancelled', createdAt: changedAt },
    { id: 4, documentId: 'active', workflowStatus: 'Scheduled', createdAt: changedAt,
      rescheduleHistory: [{ previousData: { addressLine1: 'Old road' }, newData: { addressLine1: 'New road' } }] },
    { id: 5, documentId: 'historical', workflowStatus: 'Cancelled', createdAt: changedAt,
      rescheduleHistory: [{ eventType: 'Cancelled', changedAt }] },
    { id: 6, documentId: 'unlogged', workflowStatus: 'Cancelled', createdAt: changedAt },
  ];
  const strapi = { db: { query(uid) {
    if (uid.includes('appointment-change')) return { findMany: async ({ where }) =>
      where.eventType === 'Cancelled' ? [
        { changedAt, sourceGroup: { documentId: 'group' } },
        { changedAt, affectedSubmissions: [{ documentId: 'individual' }, { documentId: 'active' }] },
      ] : [] };
    const grouped = uid.includes('appointment-group');
    return {
      count: async () => grouped ? 1 : 4,
      findMany: async ({ select }) => grouped ? groups
        : select.includes('rescheduleHistory') ? products : products.filter(row => !row.appointmentGroup),
    };
  } } };
  const result = await listCustomerAppointments(strapi, {
    customerId: 1, page: 1, pageSize: 10, formTags: ['try-at-home', 'product-video-call'],
  });
  const find = id => result.data.find(row => row.documentId === id);
  for (const id of ['member', 'individual', 'historical']) assert.equal(find(id).cancelledAt, changedAt);
  assert.equal(find('unlogged').cancelledAt, null);
  assert.equal(Object.hasOwn(find('active'), 'cancelledAt'), false);
  assert.equal(find('member').rescheduleCount, 0);
  assert.equal(find('member').reschedulesLeft, 2);
  assert.equal(find('active').rescheduleCount, 1);
  assert.equal(find('active').reschedulesLeft, 1);
});
