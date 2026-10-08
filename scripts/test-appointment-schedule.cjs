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

test('rescheduling allows the entire date three calendar days before every appointment type in IST', () => {
  for (const tag of ['try-at-home', 'try-at-home-form', 'store-visit', 'product-store-visit',
    'schedule-video-call', 'product-video-call', 'book-an-appointment']) {
    for (const slot of ['9:00 AM - 10:00 AM', '11:00 AM - 12:00 PM', '11:00 PM', 'Evening', undefined]) {
      const validate = now => validateReschedulingWindow('2026-10-09', slot, tag, new Date(now));
      assert.equal(validate('2026-10-05T23:59:59.999+05:30'), undefined, tag + ': before cutoff date');
      assert.equal(validate('2026-10-06T00:00:00+05:30'), undefined, tag + ': start of cutoff date');
      assert.equal(validate('2026-10-06T09:00:00+05:30'), undefined, tag + ': former hourly cutoff');
      assert.equal(validate('2026-10-06T12:00:00+05:30'), undefined, tag + ': after former hourly cutoff');
      assert.equal(validate('2026-10-06T23:59:59.999+05:30'), undefined, tag + ': end of cutoff date');
      assert.equal(validate('2026-10-07T00:00:00+05:30'),
        'You cannot reschedule as have passed the 3 days window period.', tag + ': after cutoff date');
      assert.ok(validate('2026-10-09T09:00:00+05:30'), tag + ': appointment starting');
      assert.ok(validate('2026-10-10T00:00:00+05:30'), tag + ': past appointment');
    }
  }
});

test('calendar-day cutoff uses India time and handles month, year, and leap-day boundaries', () => {
  for (const [date, allowed, denied] of [
    ['2026-10-09', '2026-10-06T18:29:59.999Z', '2026-10-06T18:30:00Z'],
    ['2026-11-02', '2026-10-30T23:59:59.999+05:30', '2026-10-31T00:00:00+05:30'],
    ['2027-01-02', '2026-12-30T23:59:59.999+05:30', '2026-12-31T00:00:00+05:30'],
    ['2028-03-02', '2028-02-28T23:59:59.999+05:30', '2028-02-29T00:00:00+05:30'],
  ]) {
    assert.equal(validateReschedulingWindow(date, '9:00 AM', 'store-visit', new Date(allowed)), undefined);
    assert.ok(validateReschedulingWindow(date, '9:00 AM', 'store-visit', new Date(denied)));
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
