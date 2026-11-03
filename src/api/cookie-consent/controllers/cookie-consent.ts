import { factories } from '@strapi/strapi';
import { checkFormSubmissionRateLimit, clientIp } from '../../../utils/form-submission-rate-limit';

const UID = 'api::cookie-consent.cookie-consent';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default factories.createCoreController(UID as any, ({ strapi }) => ({
  async record(ctx) {
    const input = ctx.request.body ?? {};
    if (!uuid.test(input.requestId) || !uuid.test(input.browserId) ||
      typeof input.noticeVersion !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.noticeVersion) ||
      typeof input.analytics !== 'boolean' || typeof input.marketing !== 'boolean') {
      return ctx.badRequest('Invalid consent choice.');
    }
    const customerId = input.magentoCustomerId;
    if (customerId !== undefined && (!Number.isSafeInteger(customerId) || customerId <= 0)) {
      return ctx.badRequest('Invalid customer ID.');
    }
    const existing = await strapi.db.query(UID as any).findOne({ where: { requestId: input.requestId } });
    if (existing) return { ok: true, requestId: input.requestId };
    const limit = await checkFormSubmissionRateLimit(['cookie-consent', clientIp(ctx)], strapi.log);
    if (!limit.allowed) {
      ctx.set('Retry-After', String(limit.retryAfterSeconds));
      return limit.unavailable ? ctx.serviceUnavailable('Consent audit unavailable.') : ctx.tooManyRequests('Too many consent changes.');
    }
    try {
      await strapi.db.query(UID as any).create({ data: {
        requestId: input.requestId,
        browserId: input.browserId,
        ...(customerId ? { magentoCustomerId: customerId } : {}),
        noticeVersion: input.noticeVersion,
        analytics: input.analytics,
        marketing: input.marketing,
        recordedAt: new Date().toISOString(),
      } });
    } catch (error) {
      const retry = await strapi.db.query(UID as any).findOne({ where: { requestId: input.requestId } });
      if (!retry) throw error;
    }
    return { ok: true, requestId: input.requestId };
  },
}));
