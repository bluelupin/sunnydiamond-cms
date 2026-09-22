import type { Core } from '@strapi/strapi';
import { tryAtHomeConfirmedTemplate } from '../emails/try-at-home-confirmed';
import { validAppointmentDate } from './appointment-schedule';

interface TryAtHomeConfirmation {
  documentId: string;
  appointmentId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  requestedDate?: string | null;
  selectedTimeSlot?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  productName: string;
}

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

export async function sendTryAtHomeConfirmationEmail(strapi: Core.Strapi, data: TryAtHomeConfirmation) {
  const to = data.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ||
      !validAppointmentDate(data.requestedDate) || !data.selectedTimeSlot?.trim()) return;
  const deliveryAddress = [data.addressLine1, data.addressLine2, data.city, data.state, data.pincode]
    .map(value => value?.trim()).filter(Boolean).join(', ');
  try {
    await strapi.plugin('email').service('email').send({
      to,
      ...tryAtHomeConfirmedTemplate({
        appointmentId: data.appointmentId,
        customerName: data.customerName, appointmentDate: data.requestedDate,
        appointmentTime: data.selectedTimeSlot, deliveryAddress: deliveryAddress || 'Not specified',
        productName: data.productName,
        manageUrl: manageUrl(data.documentId),
      }),
    });
    strapi.log.info(`Try at Home confirmation email accepted by the email provider for appointment ${data.documentId}.`);
  } catch {
    strapi.log.error(`Try at Home confirmation email failed for appointment ${data.documentId}; the appointment remains saved.`);
  }
}
