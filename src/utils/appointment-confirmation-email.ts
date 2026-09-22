import type { Core } from '@strapi/strapi';
import { appointmentConfirmedTemplate } from '../emails/appointment-confirmed';
import { validAppointmentDate } from './appointment-schedule';

interface StoreVisitConfirmation {
  documentId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  requestedDate?: string | null;
  selectedTimeSlot?: string | null;
  location: string;
}

const manageUrl = (documentId: string) => {
  const configured = process.env.APPOINTMENT_MANAGE_URL?.trim();
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.searchParams.set('documentId', documentId);
    return url.toString();
  } catch {
    return undefined;
  }
};

export async function sendStoreVisitConfirmationEmail(strapi: Core.Strapi, data: StoreVisitConfirmation) {
  const to = data.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) return;
  if (!validAppointmentDate(data.requestedDate) || !data.selectedTimeSlot?.trim()) return;
  try {
    await strapi.plugin('email').service('email').send({
      to,
      ...appointmentConfirmedTemplate({
        documentId: data.documentId,
        customerName: data.customerName,
        requestedDate: data.requestedDate,
        selectedTimeSlot: data.selectedTimeSlot,
        location: data.location,
        manageUrl: manageUrl(data.documentId),
      }),
    });
    strapi.log.info(`Confirmation email accepted by the email provider for appointment ${data.documentId}.`);
  } catch {
    strapi.log.error(`Confirmation email failed for appointment ${data.documentId}; the appointment remains saved.`);
  }
}
