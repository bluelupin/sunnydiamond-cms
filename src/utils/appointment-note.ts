/** Customer note is stored in the existing requestDetails field. */
export function appointmentNoteChanges(input: any): { data: Record<string, any>; error?: string } {
  const supplied = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
  if (!supplied('requestDetails') && !supplied('note')) return { data: {} };
  if (supplied('requestDetails') && supplied('note') && input.requestDetails !== input.note) {
    return { data: {}, error: 'Send either requestDetails or note, or use the same value for both.' };
  }
  const value = supplied('requestDetails') ? input.requestDetails : input.note;
  if (value !== null && typeof value !== 'string') return { data: {}, error: 'requestDetails must be text or null.' };
  return { data: { requestDetails: value?.trim() || null } };
}
