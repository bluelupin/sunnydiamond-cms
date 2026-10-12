import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { checkSharedRateLimit } from './resume-parser-rate-limit';

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  unavailable?: boolean;
};

const positiveInteger = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`Invalid ${name}.`);
  return parsed;
};

export const formRateLimitConfig = () => ({
  max: positiveInteger('FORM_SUBMISSION_RATE_LIMIT_MAX', 5),
  totalMax: positiveInteger('FORM_SUBMISSION_RATE_LIMIT_TOTAL_MAX', 20),
  windowMs: positiveInteger('FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000),
  prefix: process.env.FORM_SUBMISSION_RATE_LIMIT_REDIS_PREFIX || 'sunnydiamond:form-rate-limit:v1',
});

/** Career email never defines a fresh quota; other forms retain their form/action scope. */
export async function checkFormSubmissionRateLimit(
  keyParts: Array<string | undefined>,
  logger?: { error(message: string): unknown },
): Promise<RateLimitResult> {
  const config = formRateLimitConfig();
  const [scope, ip, formTag] = keyParts;
  // UID lookup can be case-insensitive in the database. Case variants share a quota.
  const discriminator = scope === 'generic' || scope === 'product' ? formTag?.trim().toLowerCase() : formTag;
  const keys = scope === 'job-opening' || scope === 'bespoke' || scope === 'submission-total'
    ? [scope, ip]
    : [scope, ip, discriminator && discriminator.length <= 100 ? discriminator : 'invalid-form'];
  try {
    return await checkSharedRateLimit(keys, {
      ...config, max: scope === 'submission-total' ? config.totalMax : config.max,
    });
  } catch {
    logger?.error('Form submission Redis rate limiter unavailable.');
    return { allowed: false, retryAfterSeconds: 5, unavailable: true };
  }
};

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * The shopper's IP for rate limits. Every form reaches the CMS through the website server,
 * so its forwarded IP counts, but only with the shared secret: the form routes are public
 * and anyone could otherwise rotate a made-up IP past the limit. Otherwise nginx's
 * X-Real-IP (port 1337 is not public), then the socket address.
 */
export const clientIp = (ctx: any): string => {
  const header = (name: string) => {
    const value = ctx.get?.(name)?.trim();
    return value && isIP(value) ? value : undefined;
  };
  const secret = process.env.CMS_FORWARDED_IP_SECRET?.trim();
  const given = ctx.get?.('x-sunny-forwarded-secret')?.trim();
  const forwarded = secret && given && sameSecret(given, secret) ? header('x-sunny-client-ip') : undefined;
  return forwarded ?? header('x-real-ip') ?? ctx.ip;
};
