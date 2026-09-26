import { rm } from 'node:fs/promises';
import { checkFormSubmissionRateLimit, clientIp } from '../utils/form-submission-rate-limit';

const MAX_BODY_BYTES = 5 * 1024 * 1024 + 16 * 1024;
let busy = false;

export default () => async (ctx: any, next: () => Promise<unknown>) => {
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

  const limit = checkFormSubmissionRateLimit(['resume-parser', clientIp(ctx)]);
  if (!limit.allowed) {
    ctx.set('Retry-After', String(limit.retryAfterSeconds));
    ctx.throw(429, 'Too many resume parses. Try again later.');
  }

  busy = true;
  try {
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
