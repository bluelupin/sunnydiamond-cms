const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./resume-test-helpers.cjs');
const { mutateHomeTrialGroup: mutate } = loadTs('src/utils/mutate-home-trial-group.ts');
const { appointmentGroupScheduleKey } = loadTs('src/utils/home-trial-group-key.ts');
const PRODUCT = 'api::product-submission.product-submission';
const GROUP = 'api::appointment-group.appointment-group';
const CHANGE = 'api::appointment-change.appointment-change';
const oldDate = '2099-10-12', newDate = '2099-10-14', slot = '11:00 AM - 12:00 PM';
const move = { documentId: 'product-1', customerId: 7, action: 'reschedule', requestedDate: newDate, selectedTimeSlot: slot };
const historyEntry = { previousData: { requestedDate: '2099-10-10', selectedTimeSlot: slot },
  newData: { requestedDate: oldDate, selectedTimeSlot: slot }, changedAt: '2026-10-05T12:00:00Z' };

function harness({ legacy = false, rollback = false, history = [] } = {}) {
  const group = { id: 1, documentId: 'group-1', formTag: 'schedule-video-call', magentoCustomerId: 7,
    appointmentReference: 'VC-2099-000001', workflowStatus: 'Scheduled', requestedDate: oldDate, selectedTimeSlot: slot };
  group.activeScheduleKey = appointmentGroupScheduleKey(7, oldDate, slot, group);
  const store = {
    [GROUP]: legacy ? [] : [group], [CHANGE]: [],
    [PRODUCT]: [1, 2].map(id => ({ id, documentId: `product-${id}`, formTag: 'schedule-video-call',
      magentoCustomerId: 7, workflowStatus: 'Scheduled', requestedDate: oldDate, selectedTimeSlot: slot,
      customerName: 'Alex', customerEmail: 'alex@example.com', customerPhone: '9876543210',
      productId: String(id), productName: `Ring ${id}`, rescheduleHistory: history,
      appointmentGroup: legacy ? null : 'group-1' })),
  };
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (key === 'appointmentGroup' || key === 'sourceGroup') {
      return value?.$null ? !row[key] : row[key] === value.documentId;
    }
    if (value && typeof value === 'object' && '$in' in value) return value.$in.includes(row[key]);
    return row[key] === value;
  });
  const copy = (row, populate) => {
    if (!row) return null;
    const result = structuredClone(row);
    if (populate?.appointmentGroup && row.appointmentGroup) {
      result.appointmentGroup = structuredClone(store[GROUP].find(g => g.documentId === row.appointmentGroup));
    }
    return result;
  };
  const sent = [], callbacks = [];
  const strapi = {
    log: { info() {}, error() {} },
    plugin: () => ({ service: () => ({ send: async mail => sent.push(mail) }) }),
    db: {
      metadata: { get: uid => ({ tableName: uid }) },
      connection: uid => {
        let keys;
        const chain = { transacting: () => chain, where: () => chain,
          whereIn: (field, values) => { if (field === 'active_schedule_key') keys = values; return chain; },
          orderBy: () => chain, forUpdate: async () => (store[uid] ?? []).filter(row => !keys || keys.includes(row.activeScheduleKey))
            .map(row => ({ document_id: row.documentId, active_schedule_key: row.activeScheduleKey })) };
        return chain;
      },
      query: uid => ({
        findOne: async ({ where, populate }) => copy(store[uid].find(row => matches(row, where)), populate),
        findMany: async ({ where }) => store[uid].filter(row => matches(row, where)).map(row => copy(row)),
      }),
      transaction: async run => {
        const before = structuredClone(store), pending = [];
        try {
          const result = await run({ trx: {}, onCommit: callback => pending.push(callback) });
          if (rollback) throw new Error('simulated rollback');
          callbacks.push(...pending);
          return result;
        } catch (error) {
          Object.assign(store, before);
          throw error;
        }
      },
    },
    documents: uid => ({
      findOne: async ({ documentId }) => copy(store[uid].find(row => row.documentId === documentId)),
      findFirst: async () => ({ availableTimeSlots: [{ timeString: slot }] }),
      create: async ({ data }) => {
        const record = { ...structuredClone(data), id: store[uid].length + 1, documentId: `${uid}-${store[uid].length + 1}` };
        store[uid].push(record); return copy(record);
      },
      update: async ({ documentId, data }) => {
        const record = store[uid].find(row => row.documentId === documentId);
        Object.assign(record, structuredClone(data)); return copy(record);
      },
    }),
  };
  return { strapi, store, sent, callbacks, commit: async () => {
    for (const callback of callbacks.splice(0)) callback();
    await new Promise(resolve => setImmediate(resolve));
  } };
}

for (const legacy of [false, true]) {
  test(`${legacy ? 'existing ungrouped' : 'grouped'} video calls reschedule with one history entry and one email`, async () => {
    const h = harness({ legacy });
    const result = await mutate(h.strapi, move);
    assert.equal(result.changed, true);
    assert.deepEqual(result.data.affectedProductDocumentIds, ['product-1', 'product-2']);
    assert.equal(h.store[CHANGE].length, 1);
    assert.equal(h.store[CHANGE][0].affectedSubmissions.connect.length, 2);
    assert.ok(h.store[PRODUCT].every(row => row.requestedDate === newDate && row.appointmentGroup === result.data.appointmentGroupId));
    assert.equal(h.sent.length, 0);
    assert.equal(h.callbacks.length, 1);
    await h.commit();
    assert.equal(h.sent.length, 1);
    assert.match(h.sent[0].html, /Ring 1/);
    assert.match(h.sent[0].html, /Ring 2/);
    assert.match(h.sent[0].html, /Video/i);
    const repeat = await mutate(h.strapi, { ...move, documentId: 'product-2' });
    assert.equal(repeat.changed, false);
    assert.equal(h.store[CHANGE].length, 1);
    assert.equal(h.callbacks.length, 0);
  });
}

test('a failed transaction rolls back all products, adoption and history and sends no email', async () => {
  const h = harness({ legacy: true, rollback: true });
  await assert.rejects(mutate(h.strapi, move), /rollback/);
  assert.ok(h.store[PRODUCT].every(row => row.requestedDate === oldDate && !row.appointmentGroup));
  assert.equal(h.store[GROUP].length, 0);
  assert.equal(h.store[CHANGE].length, 0);
  assert.equal(h.callbacks.length, 0);
  assert.equal(h.sent.length, 0);
});

test('legacy adoption preserves the existing two-reschedule limit', async () => {
  const h = harness({ legacy: true, history: [historyEntry, historyEntry] });
  const result = await mutate(h.strapi, move);
  assert.match(result.error, /twice/);
  assert.ok(h.store[PRODUCT].every(row => row.requestedDate === oldDate));
  assert.equal(h.store[CHANGE].filter(row => row.actorType === 'Customer').length, 0);
  assert.equal(h.callbacks.length, 0);
});

test('adoption excludes other customers, other slots, home trials and inactive bookings', async () => {
  const h = harness({ legacy: true });
  const representative = h.store[PRODUCT][0];
  for (const changes of [{ magentoCustomerId: 8 }, { requestedDate: newDate },
    { formTag: 'try-at-home-form' }, { workflowStatus: 'Cancelled' }]) {
    h.store[PRODUCT].push({ ...representative, ...changes, documentId: `other-${h.store[PRODUCT].length}` });
  }
  await mutate(h.strapi, move);
  assert.ok(h.store[PRODUCT].slice(2).every(row => !row.appointmentGroup));
  assert.equal(h.store[CHANGE][0].affectedSubmissions.connect.length, 2);
});

test('cancelling a video-call group records one event and sends one email', async () => {
  const h = harness();
  await mutate(h.strapi, { ...move, action: 'cancel' });
  assert.ok(h.store[PRODUCT].every(row => row.workflowStatus === 'Cancelled'));
  assert.equal(h.store[CHANGE].length, 1);
  assert.equal(h.store[CHANGE][0].eventType, 'Cancelled');
  await h.commit();
  assert.equal(h.sent.length, 1);
});

test('rescheduling into an existing video-call slot merges products and sends one email', async () => {
  const h = harness();
  const destination = { ...h.store[GROUP][0], id: 2, documentId: 'group-2', requestedDate: newDate,
    appointmentReference: 'VC-2099-000002' };
  destination.activeScheduleKey = appointmentGroupScheduleKey(7, newDate, slot, destination);
  h.store[GROUP].push(destination);
  h.store[PRODUCT].push({ ...h.store[PRODUCT][0], id: 3, documentId: 'product-3', productName: 'Ring 3',
    requestedDate: newDate, appointmentGroup: 'group-2' });
  const result = await mutate(h.strapi, move);
  assert.equal(result.data.appointmentGroupId, 'group-2');
  assert.ok(h.store[PRODUCT].every(row => row.appointmentGroup === 'group-2'));
  assert.equal(h.store[GROUP][0].mergedInto, 'group-2');
  assert.equal(h.store[CHANGE].length, 1);
  await h.commit();
  assert.equal(h.sent.length, 1);
  for (const name of ['Ring 1', 'Ring 2', 'Ring 3']) assert.ok(h.sent[0].html.includes(name));
});

test('video-call group uses a two-hour notice window rather than the home-trial window', async () => {
  const schedule = loadTs('src/utils/appointment-schedule.ts');
  for (const [now, allowed] of [['2099-10-12T02:30:00Z', true], ['2099-10-12T04:30:00Z', false]]) {
    const { mutateHomeTrialGroup: atTime } = loadTs('src/utils/mutate-home-trial-group.ts', {
      './appointment-schedule': { ...schedule, validateReschedulingWindow: (date, time, tag) =>
        schedule.validateReschedulingWindow(date, time, tag, new Date(now)) },
    });
    const h = harness();
    const result = await atTime(h.strapi, move);
    if (allowed) assert.equal(result.changed, true);
    else {
      assert.match(result.error, /at least 2 hours/);
      assert.equal(h.store[CHANGE].length, 0);
      assert.equal(h.callbacks.length, 0);
    }
  }
});
