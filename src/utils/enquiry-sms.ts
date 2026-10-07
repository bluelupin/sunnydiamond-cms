import type { Core } from '@strapi/strapi';
import { enqueueSmsNotification } from './sms-notification-queue';

/** Call after saving the enquiry and any uploads. Queue failures preserve the submission. */
export async function queueEnquirySms(strapi: Core.Strapi, data: {
  documentId: string; phone?: string;
}, notificationType: 'enquiryReceived' | 'serviceEnquiryReceived' = 'enquiryReceived') {
  if (!data.phone) return { status: 'skipped' as const, reason: 'invalid-recipient' as const };
  try {
    return await enqueueSmsNotification(strapi, {
      applicationDocumentId: data.documentId,
      notificationType,
      recipient: data.phone,
    });
  } catch {
    strapi.log.error('Enquiry SMS could not be queued; the enquiry remains saved.');
    return { status: 'failed' as const };
  }
}
