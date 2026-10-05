import type { Core } from '@strapi/strapi';
import { nextCalendarDate, sendShowroomAppointmentReminder } from './showroom-appointment-reminder';

const UID = 'api::generic-submission.generic-submission';

/** General Enquiries bookings share the showroom reminder and its per-date delivery marker. */
export async function sendTomorrowGenericAppointmentReminders(strapi: Core.Strapi, today?: string) {
  const appointmentDate = nextCalendarDate(today);
  const appointments = await strapi.documents(UID as any).findMany({
    filters: { formTag: 'book-an-appointment', preferredDate: appointmentDate },
    populate: { preferredShowroom: true },
  } as any);
  let sent = 0;
  for (const appointment of appointments as any[]) {
    if (['Cancelled', 'Visited', 'Closed'].includes(appointment.workflowStatus) ||
        appointment.reminderSentForDate === appointmentDate) continue;
    if (await sendShowroomAppointmentReminder(strapi, {
      ...appointment, customerName: appointment.fullName, customerEmail: appointment.email,
      requestedDate: appointment.preferredDate,
    })) {
      await strapi.documents(UID as any).update({
        documentId: appointment.documentId, data: { reminderSentForDate: appointmentDate },
      } as any);
      sent += 1;
    }
  }
  strapi.log.info(`Book-an-appointment reminders: ${sent} sent for ${appointmentDate}.`);
  return { appointmentDate, sent };
}
