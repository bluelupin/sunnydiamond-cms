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
