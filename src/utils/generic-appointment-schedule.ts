import { validateAppointmentSchedule } from './appointment-schedule';

/** Generic builders can configure appointment times inside a dynamic dropdown. */
export function validateGenericAppointmentSchedule(date: unknown, slot: unknown, form: any) {
  const slots = form.availableTimeSlots?.length ? form.availableTimeSlots
    : (form.dynamicFields ?? [])
      .filter((field: any) => field.fieldType === 'dropdown' && /\btime\b|\btimeslot\b/i.test(field.label ?? ''))
      .flatMap((field: any) => (field.dropdownOptions ?? []).map((option: any) => ({ timeString: option.optionValue })));
  return validateAppointmentSchedule(date, slot, { ...form, availableTimeSlots: slots });
}
