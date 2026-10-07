import type { Core } from '@strapi/strapi';
import { sendSms, smsConfig } from './sms-service';

const UID = 'api::sms-notification.sms-notification';
const bounded = (value: number | undefined, fallback: number, max: number) =>
  Number.isSafeInteger(value) && value > 0 ? Math.min(value, max) : fallback;

/** Atomic claims protect against overlapping cron runs and multiple CMS instances. */
export async function processSmsNotifications(strapi: Core.Strapi, request: typeof fetch = fetch) {
  const config = smsConfig(strapi);
  if (!config?.enabled || !config.authKey?.trim() || !config.senderId?.trim()) return;
  const records = strapi.db.query(UID as any);
  const maxAttempts = bounded(config.maxAttempts, 3, 10);
  const batchSize = bounded(config.batchSize, 10, 100);
  const retryDelay = bounded(config.retryDelaySeconds, 60, 3600);
  const timeout = Number.isSafeInteger(config.requestTimeoutMs) && config.requestTimeoutMs > 0
    ? config.requestTimeoutMs : 10000;
  const now = new Date();
  // A crashed worker may already have sent the SMS. Never return its claim to pending.
  await records.updateMany({ where: { status: 'processing', lastAttemptAt: {
    $lt: new Date(now.getTime() - timeout - 60000).toISOString(),
  } }, data: { status: 'unknown', lastErrorCode: 'worker-interrupted', nextAttemptAt: null } });
  const rows = await records.findMany({ where: { status: 'pending', $or: [
    { nextAttemptAt: { $null: true } }, { nextAttemptAt: { $lte: now.toISOString() } },
  ] }, orderBy: { id: 'asc' }, limit: batchSize });
  for (const row of rows) {
    const attempt = (row.attempts ?? 0) + 1;
    if (attempt > maxAttempts || !row.templateId?.trim()) {
      await records.updateMany({ where: { id: row.id, status: 'pending', attempts: row.attempts ?? 0 },
        data: { status: 'failed', lastErrorCode: attempt > maxAttempts ? 'attempt-limit' : 'missing-template', nextAttemptAt: null } });
      continue;
    }
    // Compare the attempt counter too: a stale reader must not reclaim a newly deferred retry.
    const claim = await records.updateMany({ where: { id: row.id, status: 'pending', attempts: row.attempts ?? 0 },
      data: { status: 'processing', attempts: attempt, lastAttemptAt: new Date().toISOString(), nextAttemptAt: null } });
    if (claim.count !== 1) continue;
    try {
      const result = await sendSms(strapi, { notificationType: row.notificationType,
        recipient: row.recipient, templateId: row.templateId }, request);
      let data: Record<string, unknown>;
      if (result.status === 'accepted') {
        data = { status: 'accepted', providerMessageId: result.providerMessageId,
          acceptedAt: new Date().toISOString(), lastErrorCode: null, nextAttemptAt: null };
      } else if (result.status === 'skipped') {
        data = { status: 'pending', attempts: attempt - 1, lastErrorCode: result.reason,
          nextAttemptAt: new Date(Date.now() + retryDelay * 1000).toISOString() };
      } else {
        // Only an explicit rejection with HTTP 429 is automatically retried.
        // Timeouts, malformed responses and server failures may follow acceptance.
        const retry = result.status === 'rejected' && result.reason === 'provider-rejected'
          && result.httpStatus === 429 && attempt < maxAttempts;
        data = { status: retry ? 'pending' : result.status === 'unknown' ? 'unknown' : 'failed',
          lastErrorCode: `${result.reason}${result.httpStatus ? `-${result.httpStatus}` : ''}`,
          nextAttemptAt: retry ? new Date(Date.now() + Math.min(retryDelay * 2 ** (attempt - 1), 3600) * 1000).toISOString() : null };
      }
      await records.updateMany({ where: { id: row.id, status: 'processing', attempts: attempt }, data });
    } catch {
      // Preserve the processing claim if recording fails; stale recovery marks it unknown.
      strapi.log.error(`SMS queue processing failed for notification ${row.documentId}; automatic resend withheld.`);
    }
  }
}
