export const ADDRESS_FIELDS = ['addressLine1', 'addressLine2', 'city', 'pincode', 'state'];

export const appointmentAddressSnapshot = (row: any) => Object.fromEntries(ADDRESS_FIELDS.map(field =>
  [field, field === 'state' ? (typeof row.state === 'string' ? row.state : row.state?.documentId) ?? null : row[field] ?? null]));

export const appointmentAddressChanged = (before: any, after: any) => {
  const previous = appointmentAddressSnapshot(before);
  const next = appointmentAddressSnapshot(after);
  return ADDRESS_FIELDS.some(field => (previous[field] ?? '') !== (next[field] ?? ''));
};

export function appointmentAddressChanges(input: any): { data: Record<string, any>; error?: string } {
  const data: Record<string, any> = {};
  for (const field of ADDRESS_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    if (input[field] !== null && typeof input[field] !== 'string') return { data, error: `${field} must be text.` };
    data[field] = input[field]?.trim() || null;
  }
  return { data };
}
