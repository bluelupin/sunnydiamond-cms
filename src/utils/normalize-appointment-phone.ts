/**
 * Canonical phone for identity matching, without changing stored contact details.
 * Bare Indian mobile numbers use +91; other countries require an explicit + or 00.
 * Returns undefined for invalid or ambiguous input. This does not verify ownership.
 */
export function normalizeAppointmentPhone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const phone = value.trim();
  if (!phone || !/^\+?[0-9\s().-]+$/.test(phone)) return undefined;
  let digits = phone.replace(/\D/g, '');
  const international = phone.startsWith('+') || digits.startsWith('00');
  if (!phone.startsWith('+') && digits.startsWith('00')) digits = digits.slice(2);
  if (!international) {
    if (/^0[6-9]\d{9}$/.test(digits)) digits = digits.slice(1);
    if (/^[6-9]\d{9}$/.test(digits)) digits = '91' + digits;
    else if (!/^91[6-9]\d{9}$/.test(digits)) return undefined;
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) return undefined;
  if (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits)) return undefined;
  return '+' + digits;
}
