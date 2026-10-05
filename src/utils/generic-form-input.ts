export const fieldValue = (input: any, label: string) => {
  const normalized = label.trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    name: ['fullName', 'name'],
    'full name': ['fullName', 'name'],
    phone: ['phone'],
    'phone no.': ['phone'],
    'phone no': ['phone'],
    email: ['email'],
    'email id': ['email'],
    message: ['notes', 'message'],
    notes: ['notes', 'message'],
    'reason for contacting us': ['reasonForContact', 'reason'],
    'reason for contacting': ['reasonForContact', 'reason'],
    'preferred showroom': ['preferredShowroom', 'showroom'],
    'preferred date': ['preferredDate', 'date'],
    'preferred time': ['selectedTimeSlot'],
    'preferred time slot': ['selectedTimeSlot'],
    'preferred timeslot': ['selectedTimeSlot'],
    'select time slot': ['selectedTimeSlot'],
    'select time': ['selectedTimeSlot'],
    'time': ['selectedTimeSlot'],
    'timeslot': ['selectedTimeSlot'],
    'time slot': ['selectedTimeSlot'],
    'selected time slot': ['selectedTimeSlot'],
  };

  const keys = aliases[normalized] ?? [label];
  return keys.find((key) => typeof input[key] === 'string' && input[key].trim().length > 0);
};

