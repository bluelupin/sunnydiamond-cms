import { rm } from 'node:fs/promises';
import { clientIp } from '../utils/form-submission-rate-limit';
import { checkResumeParserRateLimit } from '../utils/resume-parser-rate-limit';

const MAX_BODY_BYTES = 5 * 1024 * 1024 + 16 * 1024;
let busy = false;

export default (_config: unknown, { strapi }: { strapi: any }) => async (ctx: any, next: () => Promise<unknown>) => {
  if (ctx.method !== 'POST' || ctx.path !== '/api/careers/parse-resume') {
    return next();
  }

  if (process.env.RESUME_PARSER_ENABLED !== 'true' || !process.env.OPENAI_API_KEY) {
    ctx.throw(503, 'Resume parser is unavailable.');
  }
  if (!ctx.is('multipart/form-data')) ctx.throw(400, 'Use multipart/form-data.');

  const length = Number(ctx.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    ctx.throw(413, 'Resume must be 5MB or smaller.');
  }
  if (busy) ctx.throw(503, 'Resume parser is busy.');

  // Acquire before the Redis await so concurrent requests cannot both pass
  // the per-process extraction admission check.
  busy = true;
  try {
    let limit: Awaited<ReturnType<typeof checkResumeParserRateLimit>>;
    try {
      limit = await checkResumeParserRateLimit(['resume-parser', clientIp(ctx)]);
    } catch {
      strapi.log.error('Resume parser Redis rate limiter unavailable.');
      ctx.set('Retry-After', '5');
      ctx.throw(503, 'Resume parser is temporarily unavailable. Try again later.');
    }
    if (!limit.allowed) {
      ctx.set('Retry-After', String(limit.retryAfterSeconds));
      ctx.throw(429, 'Too many resume parses. Try again later.');
    }
    await next();
  } finally {
    busy = false;
    // Strapi cleans only files uploaded under the generic `files` field.
    const files = Object.values(ctx.request.files ?? {}).flat();
    await Promise.all(files.map(async (file: any) => {
      if (file?.filepath) await rm(file.filepath, { force: true }).catch(() => undefined);
    }));
  }
};
