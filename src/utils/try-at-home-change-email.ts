import type { Core } from '@strapi/strapi';
import { tryAtHomeRescheduledTemplate } from '../emails/try-at-home-rescheduled';
import { tryAtHomeCancelledTemplate } from '../emails/try-at-home-cancelled';

export interface TryAtHomeChangeNotification {
  documentId: string; customerName?: string | null; customerEmail?: string | null;
  appointmentReference?: string | null;
  requestedDate?: string | null; selectedTimeSlot?: string | null;
  addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; pincode?: string | null;
  productNames: string[]; manageDocumentId?: string | null; sourcePage?: string | null;
}

const safeUrl = (value?: string | null) => {
  if (!value?.trim()) return undefined;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined; }
  catch { return undefined; }
};
const manageUrl = (documentId?: string | null) => {
  const configured = process.env.APPOINTMENT_MANAGE_URL?.trim();
  if (!configured || !documentId) return undefined;
  try { const url = new URL(configured); if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.searchParams.set('documentId', documentId); return url.toString(); }
  catch { return undefined; }
};
const address = (data: TryAtHomeChangeNotification) =>
  [data.addressLine1, data.addressLine2, data.city, data.state, data.pincode].map(value => value?.trim()).filter(Boolean).join(', ') || 'Not specified';
const recipient = (data: TryAtHomeChangeNotification) => {
  const to = data.customerEmail?.trim();
  return to && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ? to : undefined;
};

export async function sendTryAtHomeRescheduledEmail(strapi: Core.Strapi, data: TryAtHomeChangeNotification) {
  const to = recipient(data);
  if (!to || !data.requestedDate || !data.selectedTimeSlot?.trim()) return;
  try {
    await strapi.plugin('email').service('email').send({ to, ...tryAtHomeRescheduledTemplate({
      appointmentId: data.appointmentReference || data.documentId, customerName: data.customerName, newDate: data.requestedDate,
      newTime: data.selectedTimeSlot, deliveryAddress: address(data), productNames: data.productNames,
      manageUrl: manageUrl(data.manageDocumentId),
    }) });
    strapi.log.info(`Try at Home reschedule email accepted by the email provider for appointment ${data.documentId}.`);
  } catch { strapi.log.error(`Try at Home reschedule email failed for appointment ${data.documentId}; the appointment remains saved.`); }
}

export async function sendTryAtHomeCancelledEmail(strapi: Core.Strapi, data: TryAtHomeChangeNotification) {
  const to = recipient(data);
  if (!to) return;
  try {
    await strapi.plugin('email').service('email').send({ to, ...tryAtHomeCancelledTemplate({
      appointmentId: data.appointmentReference || data.documentId, customerName: data.customerName, appointmentDate: data.requestedDate,
      appointmentTime: data.selectedTimeSlot, deliveryAddress: address(data), productNames: data.productNames,
      bookAppointmentUrl: safeUrl(data.sourcePage),
    }) });
    strapi.log.info(`Try at Home cancellation email accepted by the email provider for appointment ${data.documentId}.`);
  } catch { strapi.log.error(`Try at Home cancellation email failed for appointment ${data.documentId}; the cancellation remains saved.`); }
}

export function notifyTryAtHomeChangeAfterCommit(strapi: Core.Strapi, onCommit: (callback: () => void) => void,
  action: 'reschedule' | 'cancel', data: TryAtHomeChangeNotification) {
  onCommit(() => { void (action === 'cancel' ? sendTryAtHomeCancelledEmail(strapi, data) : sendTryAtHomeRescheduledEmail(strapi, data)); });
}
