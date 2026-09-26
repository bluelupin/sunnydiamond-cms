import { createHash } from 'node:crypto';
import { validAppointmentDate } from './appointment-schedule';

export const HOME_TRIAL_FORM_TAGS = ['try-at-home', 'try-at-home-form'];

type HomeTrialAddress = {
  addressLine1?: string; addressLine2?: string; city?: string; pincode?: string;
  state?: string | { documentId?: string };
};
const normalized = (value?: string) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** The resolved state document ID is shared by submission input and populated groups. */
export function homeTrialScheduleKey(customerId: number, date: string, slot: string, address: HomeTrialAddress) {
  const state = typeof address.state === 'string' ? address.state : address.state?.documentId;
  return createHash('sha256').update(JSON.stringify([
    legacyHomeTrialScheduleKey(customerId, date, slot),
    ...[address.addressLine1, address.addressLine2, address.city, address.pincode].map(normalized),
    state ?? '',
  ])).digest('hex');
}

export function legacyHomeTrialScheduleKey(customerId: number, date: string, slot: string) {
  if (!Number.isSafeInteger(customerId) || customerId <= 0 || !validAppointmentDate(date) || !slot?.trim()) {
    throw new Error('A valid customer ID, date and time slot are required for active grouping.');
  }
  return createHash('sha256').update(JSON.stringify([customerId, date, slot.trim()])).digest('hex');
}
