import type { Core } from '@strapi/strapi';
import { tryAtHomeReminderTemplate } from '../emails/try-at-home-reminder';
import { nextCalendarDate } from './showroom-appointment-reminder';

const GROUP_UID = 'api::appointment-group.appointment-group';

const manageUrl = (documentId?: string) => {
  const configured = process.env.APPOINTMENT_MANAGE_URL?.trim();
  if (!configured || !documentId) return undefined;
  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.searchParams.set('documentId', documentId);
    return url.toString();
  } catch { return undefined; }
};

export async function sendTryAtHomeReminder(strapi: Core.Strapi, group: any) {
  const products = Array.isArray(group.submissions) ? group.submissions : [];
  const representative = products[0];
  const to = representative?.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ||
      !group.requestedDate || !group.selectedTimeSlot?.trim()) return false;
  const state = typeof group.state === 'string' ? group.state : group.state?.name ?? group.state?.code;
  const address = [group.addressLine1, group.addressLine2, group.city, state, group.pincode]
    .map(value => value?.trim()).filter(Boolean).join(', ');
  const productNames = products.map((product: any) => product.productName?.trim()).filter(Boolean);
  try {
    await strapi.plugin('email').service('email').send({ to, ...tryAtHomeReminderTemplate({
      appointmentId: group.documentId, customerName: representative.customerName,
      appointmentDate: group.requestedDate, appointmentTime: group.selectedTimeSlot,
      deliveryAddress: address || 'Not specified', productNames,
      manageUrl: manageUrl(representative.documentId),
    }) });
    strapi.log.info(`Try at Home reminder email accepted by the email provider for appointment ${group.documentId}.`);
    return true;
  } catch {
    strapi.log.error(`Try at Home reminder email failed for appointment ${group.documentId}; it remains eligible for retry.`);
    return false;
  }
}

export async function sendTomorrowTryAtHomeReminders(strapi: Core.Strapi, today?: string) {
  const appointmentDate = nextCalendarDate(today);
  const groups = await strapi.documents(GROUP_UID as any).findMany({
    filters: { requestedDate: appointmentDate }, populate: { state: true, submissions: true },
  } as any);
  let sent = 0;
  for (const group of groups as any[]) {
    if (['Cancelled', 'Visited', 'Closed'].includes(group.workflowStatus) || group.reminderSentForDate === appointmentDate) continue;
    if (await sendTryAtHomeReminder(strapi, group)) {
      await strapi.documents(GROUP_UID as any).update({
        documentId: group.documentId, data: { reminderSentForDate: appointmentDate },
      } as any);
      sent += 1;
    }
  }
  strapi.log.info(`Try at Home appointment reminders: ${sent} sent for ${appointmentDate}.`);
  return { appointmentDate, sent };
}
