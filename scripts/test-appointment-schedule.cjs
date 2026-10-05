const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')))
    : require(name), module, module.exports);
  return module.exports;
}
const { countScheduleChanges, appointmentStartsAt, validateReschedulingWindow } = load('src/utils/appointment-schedule.ts');

test('rescheduling requires 3 days notice for every appointment type', () => {
  const startsAt = new Date('2026-10-12T05:30:00.000Z'); // 11 AM IST
  for (const [tag, hours] of [
    ['try-at-home', 72], ['try-at-home-form', 72],
    ['store-visit', 72], ['product-store-visit', 72],
    ['schedule-video-call', 72], ['product-video-call', 72], ['book-an-appointment', 72],
  ]) {
    const deadline = startsAt.getTime() - hours * 60 * 60_000;
    const validate = now => validateReschedulingWindow('2026-10-12', '11:00 AM - 12:00 PM', tag, new Date(now));
    assert.equal(validate(deadline - 1), undefined, `${tag}: before cutoff`);
    assert.equal(validate(deadline), undefined, `${tag}: exact cutoff`);
    assert.equal(validate(deadline + 1), "You cannot reschedule as at least 3 days' notice is required before the appointment.", `${tag}: after cutoff`);
    assert.ok(validate(startsAt.getTime()), `${tag}: appointment starting`);
    assert.ok(validate(startsAt.getTime() + 1), `${tag}: past appointment`);
  }
});

test('rescheduling rejects missing or invalid existing appointment dates', () => {
  for (const date of [undefined, null, '2026-02-30', 'invalid']) {
    assert.equal(validateReschedulingWindow(date, '11:00 AM', 'store-visit'),
      'The current appointment date is missing or invalid.');
  }
});

test('date, time and address changes count towards the reschedule limit', () => {
  const move = (from, to) => ({ previousData: { requestedDate: from, selectedTimeSlot: '10:00 AM - 11:00 AM' },
    newData: { requestedDate: to, selectedTimeSlot: '10:00 AM - 11:00 AM' } });
  const contactOnly = { previousData: { requestedDate: '2026-10-12', selectedTimeSlot: 'x', customerDetails: [{}] },
    newData: { requestedDate: '2026-10-12', selectedTimeSlot: 'x', customerDetails: [{}] } };
  const slotOnly = { previousData: { requestedDate: 'd', selectedTimeSlot: 'a' }, newData: { requestedDate: 'd', selectedTimeSlot: 'b' } };
  assert.equal(countScheduleChanges(undefined), 0);
  assert.equal(countScheduleChanges([contactOnly]), 0);
  assert.equal(countScheduleChanges([move('2026-10-12', '2026-10-14'), contactOnly, slotOnly]), 2);
  for (const field of ['addressLine1', 'addressLine2', 'city', 'pincode', 'state']) {
    const addressOnly = { previousData: { ...contactOnly.previousData, [field]: 'old' },
      newData: { ...contactOnly.newData, [field]: 'new' } };
    assert.equal(countScheduleChanges([addressOnly]), 1, field);
    assert.equal(countScheduleChanges([{ ...addressOnly, newData: addressOnly.previousData }]), 0, field);
  }
  assert.equal(countScheduleChanges([{ previousData: { addressLine2: null }, newData: { addressLine2: '' } }]), 0);
});

test('slot start is read in IST; an unreadable slot starts at midnight', () => {
  assert.equal(appointmentStartsAt('2026-10-12', '11:00 AM - 12:00 PM').toISOString(), '2026-10-12T05:30:00.000Z');
  assert.equal(appointmentStartsAt('2026-10-12', '01:00 PM - 02:00 PM').toISOString(), '2026-10-12T07:30:00.000Z');
  assert.equal(appointmentStartsAt('2026-10-12', '12:00 PM - 01:00 PM').toISOString(), '2026-10-12T06:30:00.000Z');
  assert.equal(appointmentStartsAt('2026-10-12', '12:30 AM - 1:00 AM').toISOString(), '2026-10-11T19:00:00.000Z');
  assert.equal(appointmentStartsAt('2026-10-12', 'Evening').toISOString(), '2026-10-11T18:30:00.000Z');
});
