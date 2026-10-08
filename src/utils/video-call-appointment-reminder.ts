import type { Core } from '@strapi/strapi';
import { videoCallReminderTemplate } from '../emails/video-call-appointment';
import { nextCalendarDate } from './showroom-appointment-reminder';
import { appointmentManageUrl } from './video-call-appointment-email';
import { VIDEO_CALL_FORM_TAGS } from './home-trial-group-key';

const UID = 'api::product-submission.product-submission';
const GROUP = 'api::appointment-group.appointment-group';
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
  const appointments = await strapi.documents(UID as any).findMany({
    filters: { formTag: { $in: VIDEO_CALL_FORM_TAGS }, requestedDate: appointmentDate, appointmentGroup: { $null: true } },
  } as any);
  const groups = await strapi.documents(GROUP as any).findMany({
    filters: { formTag: { $in: VIDEO_CALL_FORM_TAGS }, requestedDate: appointmentDate }, populate: { submissions: true },
  } as any);
  let sent = 0;
  for (const appointment of appointments as any[]) {
    if (['Cancelled', 'Visited', 'Closed'].includes(appointment.workflowStatus) || appointment.reminderSentForDate === appointmentDate) continue;
    if (await sendVideoCallAppointmentReminder(strapi, appointment)) {
      await strapi.documents(UID as any).update({ documentId: appointment.documentId, data: { reminderSentForDate: appointmentDate } } as any); sent += 1;
    }
  }
  for (const group of groups as any[]) {
    if (['Cancelled', 'Visited', 'Closed'].includes(group.workflowStatus) || group.reminderSentForDate === appointmentDate) continue;
    const products = group.submissions ?? [];
    if (!products.length) continue;
    if (await sendVideoCallAppointmentReminder(strapi, {
      ...products[0], ...group, documentId: products[0].documentId,
      productName: products.map((product: any) => product.productName).filter(Boolean).join(', '),
    })) {
      await strapi.documents(GROUP as any).update({ documentId: group.documentId, data: { reminderSentForDate: appointmentDate } } as any);
      sent += 1;
    }
  }
  strapi.log.info(`Video call appointment reminders: ${sent} sent for ${appointmentDate}.`);
  return { appointmentDate, sent };
}
