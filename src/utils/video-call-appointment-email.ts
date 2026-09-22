import type { Core } from '@strapi/strapi';
import { videoCallCancelledTemplate, videoCallConfirmedTemplate } from '../emails/video-call-appointment';
import { validAppointmentDate } from './appointment-schedule';

export interface VideoCallNotification {
  documentId: string; appointmentReference?: string | null; customerName?: string | null;
  customerEmail?: string | null; requestedDate?: string | null; selectedTimeSlot?: string | null;
  productName?: string | null; sourcePage?: string | null;
}

export const appointmentManageUrl = (documentId: string) => {
  const configured = process.env.APPOINTMENT_MANAGE_URL?.trim();
  if (!configured) return undefined;
  try { const url = new URL(configured); if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.searchParams.set('documentId', documentId); return url.toString(); } catch { return undefined; }
};
const webUrl = (value?: string | null) => {
  if (!value?.trim()) return undefined;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined; }
  catch { return undefined; }
};
const recipient = (value?: string | null) => {
  const to = value?.trim(); return to && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ? to : undefined;
};

export async function sendVideoCallConfirmationEmail(strapi: Core.Strapi, data: VideoCallNotification) {
  const to = recipient(data.customerEmail);
  if (!to || !validAppointmentDate(data.requestedDate) || !data.selectedTimeSlot?.trim()) return;
  try { await strapi.plugin('email').service('email').send({ to, ...videoCallConfirmedTemplate({
    appointmentId: data.appointmentReference || data.documentId, customerName: data.customerName,
    appointmentDate: data.requestedDate, appointmentTime: data.selectedTimeSlot,
    productName: data.productName, manageUrl: appointmentManageUrl(data.documentId),
  }) }); strapi.log.info(`Video call confirmation email accepted for appointment ${data.documentId}.`);
  } catch { strapi.log.error(`Video call confirmation email failed for appointment ${data.documentId}; the appointment remains saved.`); }
}

export async function sendVideoCallCancellationEmail(strapi: Core.Strapi, data: VideoCallNotification) {
  const to = recipient(data.customerEmail);
  if (!to) return;
  try { await strapi.plugin('email').service('email').send({ to, ...videoCallCancelledTemplate({
    appointmentId: data.appointmentReference || data.documentId, customerName: data.customerName,
    appointmentDate: data.requestedDate || 'Not specified', appointmentTime: data.selectedTimeSlot || 'Not specified',
    productName: data.productName, bookAppointmentUrl: webUrl(data.sourcePage),
  }) }); strapi.log.info(`Video call cancellation email accepted for appointment ${data.documentId}.`);
  } catch { strapi.log.error(`Video call cancellation email failed for appointment ${data.documentId}; the cancellation remains saved.`); }
}

export function notifyVideoCallCancellationAfterCommit(strapi: Core.Strapi, onCommit: (callback: () => void) => void, data: VideoCallNotification) {
  onCommit(() => { void sendVideoCallCancellationEmail(strapi, data); });
}
