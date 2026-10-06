export const fieldValue = (input: any, label: string) => {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^your\s+/, '');
  const aliases: Record<string, string[]> = {
    name: ['fullName', 'name'],
    'full name': ['fullName', 'name'],
    phone: ['phone'],
    'phone no.': ['phone'],
    'phone no': ['phone'],
    'phone number': ['phone'],
    'mobile': ['phone'],
    'mobile number': ['phone'],
    email: ['email'],
    'email id': ['email'],
    'email address': ['email'],
    message: ['notes', 'message'],
    notes: ['notes', 'message'],
    'describe more about your visit': ['notes', 'message'],
    'reason for contacting us': ['reasonForContact', 'reason'],
    'reason for contacting': ['reasonForContact', 'reason'],
    'preferred showroom': ['preferredShowroom', 'showroom'],
    'preferred date': ['preferredDate', 'date'],
    date: ['preferredDate', 'date'],
    'preferred time': ['selectedTimeSlot'],
    'preferred time slot': ['selectedTimeSlot'],
    'preferred timeslot': ['selectedTimeSlot'],
    'select time slot': ['selectedTimeSlot'],
    'select time': ['selectedTimeSlot'],
    'time': ['selectedTimeSlot'],
    'timeslot': ['selectedTimeSlot'],
    'time slot': ['selectedTimeSlot'],
    'time slots': ['selectedTimeSlot'],
    'selected time slot': ['selectedTimeSlot'],
  };

  const keys = aliases[normalized] ?? [label];
  return keys.find((key) => typeof input[key] === 'string' && input[key].trim().length > 0);
};


/** Email remains optional for general appointments even when older form configuration requires it. */
export const isGenericEmailField = (field: { fieldType?: string; label?: string }) =>
  field.fieldType?.toLowerCase() === 'email' ||
  /^(?:your\s+)?e-?mail(?:\s+(?:id|address))?$/i.test((field.label ?? '').trim().replace(/[\s*]+$/, ''));
