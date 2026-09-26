import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

const attempts = new Map<string, RateLimitEntry>();

const numberFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const windowMs = () => numberFromEnv(process.env.FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS);
const maxAttempts = () => numberFromEnv(process.env.FORM_SUBMISSION_RATE_LIMIT_MAX, DEFAULT_MAX_ATTEMPTS);

const cleanupExpiredEntries = (now: number) => {
  for (const [key, entry] of attempts.entries()) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
};

export const checkFormSubmissionRateLimit = (keyParts: Array<string | undefined>) => {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const key = keyParts.map((part) => part || 'unknown').join(':');
  const existing = attempts.get(key);

  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs() });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= maxAttempts()) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
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
