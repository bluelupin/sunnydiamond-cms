export const RESCHEDULABLE_FORM_TAGS = [
  'try-at-home', 'schedule-video-call', 'try-at-home-form', 'product-video-call',
];

export const validAppointmentDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const appointmentToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

/** Last permitted day is three calendar days before the existing appointment. */
export const validateReschedulingWindow = (scheduledDate: unknown, today = appointmentToday()) => {
  if (!validAppointmentDate(scheduledDate)) return 'The current appointment date is missing or invalid.';
  const deadline = new Date(`${scheduledDate}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() - 3);
  if (today > deadline.toISOString().slice(0, 10)) {
    return 'This appointment is out of the 3-day rescheduling window period.';
  }
  return undefined;
};

export const validateAppointmentSchedule = (date: unknown, slot: unknown, form: any) => {
  if (!validAppointmentDate(date)) return 'requestedDate must be a valid date in YYYY-MM-DD format.';
  if (date < appointmentToday()) return 'Appointments cannot be scheduled in the past.';
  if (typeof slot !== 'string' || !slot.trim()) return 'selectedTimeSlot is required.';
  if (!form.availableTimeSlots?.some((item: any) => item.timeString === slot)) {
    return 'selectedTimeSlot must match an available time slot for this form.';
  }
  return undefined;
};
