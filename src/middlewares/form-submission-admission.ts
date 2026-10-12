import { checkFormSubmissionRateLimit, clientIp } from '../utils/form-submission-rate-limit';

const SUBMISSION_PATHS = new Set([
  '/generic-submissions/submit',
  '/bespoke-submissions/submit',
  '/submissions-job-openings/submit',
  '/product-submissions/submit',
]);

/** Aggregate admission runs before body parsing, independent of caller-supplied fields. */
export default (_config: unknown, { strapi }: { strapi: any }) => {
  const prefix = strapi.config.get('api.rest.prefix', '/api').replace(/\/$/, '').toLowerCase();
  return async (ctx: any, next: () => Promise<unknown>) => {
    const path = ctx.path.replace(/\/$/, '').toLowerCase();
    if (ctx.method !== 'POST' || !path.startsWith(`${prefix}/`) || !SUBMISSION_PATHS.has(path.slice(prefix.length))) {
      return next();
    }
    const result = await checkFormSubmissionRateLimit(['submission-total', clientIp(ctx)], strapi.log);
    if (!result.allowed) {
      ctx.set('Retry-After', String(result.retryAfterSeconds));
      ctx.throw(result.unavailable ? 503 : 429, result.unavailable
        ? 'Form submissions are temporarily unavailable. Please try again later.'
        : 'Too many form submissions. Please try again later.');
    }
    return next();
  };
};
