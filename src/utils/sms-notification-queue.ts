import { createHash } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import { normalizeSmsPhone, smsConfig, smsReadiness, type SmsNotificationType } from './sms-service';

const UID = 'api::sms-notification.sms-notification';

/** Persistence only: does not send SMS. Invoke after the application and upload succeed. */
export async function enqueueSmsNotification(strapi: Core.Strapi, input: {
  applicationDocumentId: string; notificationType: SmsNotificationType; recipient: string;
}) {
  const config = smsConfig(strapi);
  const reason = smsReadiness(config, input.notificationType);
  // No backlog is created while disabled or waiting for the approved template ID.
  if (reason) return { status: 'skipped' as const, reason };
  const recipient = normalizeSmsPhone(input.recipient);
  if (!recipient) return { status: 'skipped' as const, reason: 'invalid-recipient' };
  const applicationDocumentId = input.applicationDocumentId?.trim();
  if (!applicationDocumentId) throw new Error('An application document ID is required for SMS notifications.');
  const deduplicationKey = createHash('sha256')
    .update(JSON.stringify([input.notificationType, applicationDocumentId])).digest('hex');
  const records = strapi.db.query(UID as any);
  const existing = await records.findOne({ where: { deduplicationKey } });
  if (existing) return { status: 'existing' as const, notification: existing };
  try {
    const notification = await records.create({ data: {
      documentId: createHash('sha256').update(`sms:${deduplicationKey}`).digest('hex').slice(0, 24),
      deduplicationKey, applicationDocumentId, notificationType: input.notificationType,
      recipient, templateId: config.templates[input.notificationType].trim(), status: 'pending', attempts: 0,
    } });
    return { status: 'queued' as const, notification };
  } catch (error) {
    // The unique index handles concurrent enqueues; read the winner after its insert.
    const code = (error as any)?.code ?? (error as any)?.original?.code ?? (error as any)?.cause?.code;
    if (['ER_DUP_ENTRY', '23505', 'SQLITE_CONSTRAINT', 'SQLITE_CONSTRAINT_UNIQUE'].includes(code)) {
      const winner = await records.findOne({ where: { deduplicationKey } });
      if (winner) return { status: 'existing' as const, notification: winner };
    }
    throw error;
  }
}
