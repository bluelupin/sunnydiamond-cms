import { factories } from '@strapi/strapi';
import { checkFormSubmissionRateLimit } from '../../../utils/form-submission-rate-limit';
import { requestLocale } from '../../../utils/request-locale';

const BESPOKE_SUBMISSION_UID = 'api::bespoke-submission.bespoke-submission';
const BESPOKE_PAGE_UID = 'api::contact-bespoke-page.contact-bespoke-page';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const stringOrUndefined = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requestData = (ctx: any) => {
  const body = ctx.request.body ?? {};
  if (typeof body.data === 'string') {
    try {
      return JSON.parse(body.data);
    } catch {
      return {};
    }
  }
  return body.data && typeof body.data === 'object' ? body.data : body;
};

const firstFile = (files: any) => {
  const file = files?.referenceImage;
  return Array.isArray(file) ? file[0] : file;
};

export default factories.createCoreController(BESPOKE_SUBMISSION_UID as any, ({ strapi }) => ({
  async submit(ctx) {
    const input = requestData(ctx);
    const locale = requestLocale(ctx, input);
    const fullName = stringOrUndefined(input.fullName);
    const phone = stringOrUndefined(input.phone);
    const email = stringOrUndefined(input.email)?.toLowerCase();
    const designVision = stringOrUndefined(input.designVision);
    const upload = firstFile(ctx.request.files);
    const rateLimit = checkFormSubmissionRateLimit(['bespoke', ctx.ip]);

    if (!rateLimit.allowed) {
      ctx.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return ctx.tooManyRequests('Too many form submissions. Please try again later.');
    }

    if (!fullName) return ctx.badRequest('fullName is required.');
    if (!phone || !/^\+?[\d\s()-]{7,20}$/.test(phone)) {
      return ctx.badRequest('phone must be a valid phone number.');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.badRequest('email must be a valid email address.');
    }
    if (!designVision) return ctx.badRequest('designVision is required.');

    const page = await strapi.documents(BESPOKE_PAGE_UID as any).findFirst({
      status: 'published',
      locale,
      populate: { customDesignForm: true },
    } as any);
    if (!page?.customDesignForm?.showField) {
      return ctx.badRequest('The bespoke custom-design form is unavailable.');
    }

    if (ctx.request.files && Object.keys(ctx.request.files).length > 0 && !upload) {
      return ctx.badRequest('Only referenceImage file uploads are supported.');
    }
    const mime = upload?.mimetype ?? upload?.type;
    if (upload && !mime?.startsWith('image/')) {
      return ctx.badRequest('referenceImage must be an image file.');
    }
    if (upload?.size && upload.size > MAX_UPLOAD_BYTES) {
      return ctx.badRequest('referenceImage must be 5MB or smaller.');
    }

    const entity = await strapi.documents(BESPOKE_SUBMISSION_UID as any).create({
      data: {
        fullName,
        phone,
        email,
        designVision,
      },
    } as any);

    if (upload) {
      await strapi.plugin('upload').service('upload').upload({
        data: {
          ref: BESPOKE_SUBMISSION_UID,
          refId: entity.id,
          field: 'referenceImage',
        },
        files: upload,
      });
    }

    return {
      data: {
        id: entity.id,
        documentId: entity.documentId,
      },
      meta: {},
    };
  },
}));
