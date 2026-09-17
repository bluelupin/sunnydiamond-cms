import { createHash } from 'node:crypto';
import { validAppointmentDate } from './appointment-schedule';

export const HOME_TRIAL_FORM_TAGS = ['try-at-home', 'try-at-home-form'];

/** Address is canonical group data, not part of the active grouping identity. */
export function homeTrialScheduleKey(customerId: number, date: string, slot: string) {
  if (!Number.isSafeInteger(customerId) || customerId <= 0 || !validAppointmentDate(date) || !slot?.trim()) {
    throw new Error('A valid customer ID, date and time slot are required for active grouping.');
  }
  return createHash('sha256').update(JSON.stringify([customerId, date, slot.trim()])).digest('hex');
}
