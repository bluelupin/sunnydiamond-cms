const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}
const { countScheduleChanges, appointmentStartsAt } = load('src/utils/appointment-schedule.ts');

test('only a new date or time counts towards the reschedule limit', () => {
  const move = (from, to) => ({ previousData: { requestedDate: from, selectedTimeSlot: '10:00 AM - 11:00 AM' },
    newData: { requestedDate: to, selectedTimeSlot: '10:00 AM - 11:00 AM' } });
  const contactOnly = { previousData: { requestedDate: '2026-10-12', selectedTimeSlot: 'x', customerDetails: [{}] },
    newData: { requestedDate: '2026-10-12', selectedTimeSlot: 'x', customerDetails: [{}] } };
  const slotOnly = { previousData: { requestedDate: 'd', selectedTimeSlot: 'a' }, newData: { requestedDate: 'd', selectedTimeSlot: 'b' } };
  assert.equal(countScheduleChanges(undefined), 0);
  assert.equal(countScheduleChanges([contactOnly]), 0);
  assert.equal(countScheduleChanges([move('2026-10-12', '2026-10-14'), contactOnly, slotOnly]), 2);
});

test('slot start is read in IST; an unreadable slot starts at midnight', () => {
  assert.equal(appointmentStartsAt('2026-10-12', '11:00 AM - 12:00 PM').toISOString(), '2026-10-12T05:30:00.000Z');
  assert.equal(appointmentStartsAt('2026-10-12', '01:00 PM - 02:00 PM').toISOString(), '2026-10-12T07:30:00.000Z');
  assert.equal(appointmentStartsAt('2026-10-12', '12:00 PM - 01:00 PM').toISOString(), '2026-10-12T06:30:00.000Z');
  assert.equal(appointmentStartsAt('2026-10-12', '12:30 AM - 1:00 AM').toISOString(), '2026-10-11T19:00:00.000Z');
  assert.equal(appointmentStartsAt('2026-10-12', 'Evening').toISOString(), '2026-10-11T18:30:00.000Z');
});
