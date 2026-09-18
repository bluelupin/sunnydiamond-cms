export const customerDetailsSnapshot = (row: any, changes: any = {}) => ({
  documentId: row.documentId,
  customerName: row.customerName ?? null,
  customerPhone: row.customerPhone ?? null,
  customerEmail: row.customerEmail ?? null,
  ...changes,
});

/** Optional contact changes only; customer ownership is never part of this patch. */
export function appointmentCustomerChanges(input: any): { data: Record<string, any>; error?: string } {
  const data: Record<string, any> = {};
  const supplied = (name: string) => Object.prototype.hasOwnProperty.call(input, name);
  if (supplied('customerName')) {
    if (typeof input.customerName !== 'string' || !input.customerName.trim()) return { data, error: 'customerName must not be empty.' };
    data.customerName = input.customerName.trim();
  }
  if (supplied('customerPhone')) {
    if (typeof input.customerPhone !== 'string') return { data, error: 'customerPhone must be a valid phone number.' };
    const digits = input.customerPhone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return { data, error: 'customerPhone must be a valid phone number.' };
    data.customerPhone = digits;
  }
  if (supplied('customerEmail')) {
    if (input.customerEmail !== null && typeof input.customerEmail !== 'string') return { data, error: 'customerEmail must be a valid email address.' };
    const email = input.customerEmail?.trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { data, error: 'customerEmail must be a valid email address.' };
    data.customerEmail = email;
  }
  return { data };
}

export const customerDetailsChanged = (rows: any[], changes: any) =>
  rows.some(row => Object.entries(changes).some(([name, value]) => (row[name] ?? null) !== value));
