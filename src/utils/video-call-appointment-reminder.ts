import type { Core } from '@strapi/strapi';
import { videoCallReminderTemplate } from '../emails/video-call-appointment';
import { nextCalendarDate } from './showroom-appointment-reminder';
import { appointmentManageUrl } from './video-call-appointment-email';

const UID = 'api::product-submission.product-submission';
export async function sendVideoCallAppointmentReminder(strapi: Core.Strapi, appointment: any) {
  const to = appointment.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) || !appointment.requestedDate || !appointment.selectedTimeSlot?.trim()) return false;
  try { await strapi.plugin('email').service('email').send({ to, ...videoCallReminderTemplate({
    appointmentId: appointment.appointmentReference || appointment.documentId, customerName: appointment.customerName,
    appointmentDate: appointment.requestedDate, appointmentTime: appointment.selectedTimeSlot,
    productName: appointment.productName, manageUrl: appointmentManageUrl(appointment.documentId),
  }) }); strapi.log.info(`Video call reminder email accepted for appointment ${appointment.documentId}.`); return true;
  } catch { strapi.log.error(`Video call reminder email failed for appointment ${appointment.documentId}; it remains eligible for retry.`); return false; }
}

export async function sendTomorrowVideoCallAppointmentReminders(strapi: Core.Strapi, today?: string) {
  const appointmentDate = nextCalendarDate(today);
  const appointments = await strapi.documents(UID as any).findMany({ filters: { formTag: 'product-video-call', requestedDate: appointmentDate } } as any);
  let sent = 0;
  for (const appointment of appointments as any[]) {
    if (['Cancelled', 'Visited', 'Closed'].includes(appointment.workflowStatus) || appointment.reminderSentForDate === appointmentDate) continue;
    if (await sendVideoCallAppointmentReminder(strapi, appointment)) {
      await strapi.documents(UID as any).update({ documentId: appointment.documentId, data: { reminderSentForDate: appointmentDate } } as any); sent += 1;
    }
  }
  strapi.log.info(`Video call appointment reminders: ${sent} sent for ${appointmentDate}.`);
  return { appointmentDate, sent };
}
