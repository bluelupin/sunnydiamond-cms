import { validateAppointmentSchedule } from './appointment-schedule';

/** Generic builders can configure appointment times inside a dynamic dropdown. */
function configuredSlots(form: any): { timeString: string }[] {
  return form.availableTimeSlots?.length ? form.availableTimeSlots
    : (form.dynamicFields ?? [])
      .filter((field: any) => field.fieldType === 'dropdown' && /\btime\b|\btimeslot\b/i.test(field.label ?? ''))
      .flatMap((field: any) => (field.dropdownOptions ?? []).map((option: any) => ({ timeString: option.optionValue })));

}

const comparableSlot = (slot: string) => {
  const parts = slot.trim().split(/\s*[-\u2013\u2014]\s*/);
  const times = parts.map(part => {
    const match = part.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);
    return match ? Number(match[1]) + ':' + match[2] + ' ' + match[3].toUpperCase() : null;
  });
  return parts.length <= 2 && times.every(Boolean) ? times.join(' - ') : slot;
};

/** Store the configured value after matching equivalent clock formatting. */
export function resolveGenericAppointmentSlot(slot: unknown, form: any): unknown {
  if (typeof slot !== 'string') return slot;
  return configuredSlots(form).find(item => typeof item.timeString === 'string' &&
    comparableSlot(item.timeString) === comparableSlot(slot))?.timeString ?? slot;
}

export function validateGenericAppointmentSchedule(date: unknown, slot: unknown, form: any) {
  return validateAppointmentSchedule(date, resolveGenericAppointmentSlot(slot, form), {
    ...form, availableTimeSlots: configuredSlots(form),
  });
}
