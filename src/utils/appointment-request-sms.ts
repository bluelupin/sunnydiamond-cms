import type { Core } from '@strapi/strapi';
import { enqueueSmsNotification } from './sms-notification-queue';

/** Queue after saving the submission and any upload, once per booking or group. */
export async function queueAppointmentRequestSms(strapi: Core.Strapi, data: {
  documentId: string; phone: string;
}) {
  try {
    return await enqueueSmsNotification(strapi, {
      applicationDocumentId: data.documentId,
      notificationType: 'appointmentRequestReceived',
      recipient: data.phone,
    });
  } catch {
    strapi.log.error('Appointment request SMS could not be queued; the appointment remains saved.');
    return { status: 'failed' as const };
  }
}
