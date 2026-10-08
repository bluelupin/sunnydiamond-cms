import type { Core } from '@strapi/strapi';
import { enqueueSmsNotification } from './sms-notification-queue';

/** Called after saving both the application and resume; queue failures are best-effort. */
export async function queueCareerApplicationSms(strapi: Core.Strapi, data: {
  documentId: string; phone: string;
}) {
  try {
    return await enqueueSmsNotification(strapi, {
      applicationDocumentId: data.documentId,
      notificationType: 'careerApplicationReceived',
      recipient: data.phone,
    });
  } catch {
    strapi.log.error(`Career acknowledgement SMS could not be queued for application ${data.documentId}; the application remains saved.`);
    return { status: 'failed' as const };
  }
}
