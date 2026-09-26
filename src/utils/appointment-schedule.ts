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
    return 'You cannot reschedule as it is outside the 3-day rescheduling window period.';
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

export const MAX_RESCHEDULES = 2;
export const RESCHEDULE_LIMIT_MESSAGE = 'You have already rescheduled this appointment twice. Please contact us.';

/** History and change rows also record contact/note-only edits; only a new date or time counts. */
export const countScheduleChanges = (entries: unknown) => (Array.isArray(entries) ? entries : [])
  .filter((entry: any) => entry?.previousData?.requestedDate !== entry?.newData?.requestedDate ||
    entry?.previousData?.selectedTimeSlot !== entry?.newData?.selectedTimeSlot).length;

/** "11:00 AM - 12:00 PM" starts at 11:00 IST; an unreadable slot counts from midnight. */
export const appointmentStartsAt = (date: string, slot?: string | null) => {
  const match = slot?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const minutes = match
    ? ((Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(match[2])
    : 0;
  return new Date(Date.parse(`${date}T00:00:00+05:30`) + minutes * 60_000);
};
