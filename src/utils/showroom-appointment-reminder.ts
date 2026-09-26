import type { Core } from '@strapi/strapi';
import { showroomAppointmentReminderTemplate } from '../emails/showroom-appointment-reminder';
import { appointmentToday } from './appointment-schedule';

const UID = 'api::product-submission.product-submission';
const plainText = (value?: string | null) => value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export const nextCalendarDate = (date = appointmentToday()) => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
};

const manageUrl = (documentId: string) => {
  const configured = process.env.APPOINTMENT_MANAGE_URL?.trim();
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.searchParams.set('documentId', documentId);
    return url.toString();
  } catch { return undefined; }
};

export async function sendShowroomAppointmentReminder(strapi: Core.Strapi, appointment: any) {
  const to = appointment.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ||
      !appointment.requestedDate || !appointment.selectedTimeSlot?.trim()) return false;
  const showroom = appointment.preferredShowroom;
  const location = [plainText(showroom?.address), showroom?.city, showroom?.state, showroom?.pincode]
    .map(value => value?.trim()).filter(Boolean).join(', ');
  try {
    await strapi.plugin('email').service('email').send({
      to,
      ...showroomAppointmentReminderTemplate({
        customerName: appointment.customerName, appointmentDate: appointment.requestedDate,
        appointmentTime: appointment.selectedTimeSlot, showroomName: showroom?.city,
        showroomAddress: location, manageUrl: manageUrl(appointment.documentId),
      }),
    });
    strapi.log.info(`Reminder email accepted by the email provider for appointment ${appointment.documentId}.`);
    return true;
  } catch {
    strapi.log.error(`Reminder email failed for appointment ${appointment.documentId}; it remains eligible for retry.`);
    return false;
  }
}

export async function sendTomorrowShowroomAppointmentReminders(strapi: Core.Strapi, today?: string) {
  const appointmentDate = nextCalendarDate(today);
  const appointments = await strapi.documents(UID as any).findMany({
    filters: { formTag: 'product-store-visit', requestedDate: appointmentDate },
    populate: { preferredShowroom: true },
  } as any);
  let sent = 0;
  for (const appointment of appointments as any[]) {
    if (['Cancelled', 'Visited', 'Closed'].includes(appointment.workflowStatus) ||
        appointment.reminderSentForDate === appointmentDate) continue;
    if (await sendShowroomAppointmentReminder(strapi, appointment)) {
      await strapi.documents(UID as any).update({
        documentId: appointment.documentId, data: { reminderSentForDate: appointmentDate },
      } as any);
      sent += 1;
    }
  }
  strapi.log.info(`Showroom appointment reminders: ${sent} sent for ${appointmentDate}.`);
  return { appointmentDate, sent };
}
