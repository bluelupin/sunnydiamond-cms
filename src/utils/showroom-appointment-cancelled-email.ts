import type { Core } from '@strapi/strapi';
import { showroomAppointmentCancelledTemplate } from '../emails/showroom-appointment-cancelled';

interface ShowroomCancellationNotification {
  documentId: string;
  appointmentReference?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  requestedDate?: string | null;
  selectedTimeSlot?: string | null;
  sourcePage?: string | null;
  preferredShowroom?: {
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    address?: string | null;
  } | null;
}

const webUrl = (value?: string | null) => {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const plainText = (value?: string | null) => value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export async function sendShowroomAppointmentCancelledEmail(
  strapi: Core.Strapi,
  data: ShowroomCancellationNotification,
) {
  const to = data.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) return;
  const showroom = data.preferredShowroom;
  const address = [plainText(showroom?.address), showroom?.city, showroom?.state, showroom?.pincode]
    .map(value => value?.trim()).filter(Boolean).join(', ');
  try {
    await strapi.plugin('email').service('email').send({
      to,
      ...showroomAppointmentCancelledTemplate({
        appointmentId: data.appointmentReference || data.documentId,
        customerName: data.customerName,
        appointmentDate: data.requestedDate,
        appointmentTime: data.selectedTimeSlot,
        showroomName: showroom?.city,
        showroomAddress: address,
        bookAppointmentUrl: webUrl(data.sourcePage),
      }),
    });
    strapi.log.info(`Cancellation email accepted by the email provider for appointment ${data.documentId}.`);
  } catch {
    strapi.log.error(`Cancellation email failed for appointment ${data.documentId}; the cancellation remains saved.`);
  }
}

export function notifyShowroomCancellationAfterCommit(
  strapi: Core.Strapi,
  onCommit: (callback: () => void) => void,
  data: ShowroomCancellationNotification,
) {
  onCommit(() => { void sendShowroomAppointmentCancelledEmail(strapi, data); });
}
