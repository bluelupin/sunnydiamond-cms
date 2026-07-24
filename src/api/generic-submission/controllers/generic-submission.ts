import { factories } from '@strapi/strapi';
import { checkFormSubmissionRateLimit } from '../../../utils/form-submission-rate-limit';

const GENERIC_SUBMISSION_UID = 'api::generic-submission.generic-submission';
const GENERIC_FORM_UID = 'api::generic-form.generic-form';

const stringOrUndefined = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const emailOrUndefined = (value: unknown) => {
  const email = stringOrUndefined(value)?.toLowerCase();
  if (!email) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

const phoneOrUndefined = (value: unknown) => {
  const phone = stringOrUndefined(value);
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
};

const dateOrUndefined = (value: unknown) => {
  const date = stringOrUndefined(value);
  if (!date) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return Number.isNaN(Date.parse(date)) ? null : date;
};

const booleanValue = (value: unknown) => value === true || value === 'true';

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

const fieldValue = (input: any, label: string) => {
  const normalized = label.toLowerCase();
  const aliases: Record<string, string[]> = {
    name: ['fullName', 'name'],
    'full name': ['fullName', 'name'],
    phone: ['phone'],
    email: ['email'],
    message: ['notes', 'message'],
    notes: ['notes', 'message'],
    'preferred showroom': ['preferredShowroom', 'showroom'],
    'preferred date': ['preferredDate', 'date'],
  };

  const keys = aliases[normalized] ?? [label];
  return keys.find((key) => stringOrUndefined(input[key]) !== undefined);
};

export default factories.createCoreController(GENERIC_SUBMISSION_UID as any, ({ strapi }) => ({
  async submit(ctx) {
    if (ctx.request.files && Object.keys(ctx.request.files).length > 0) {
      return ctx.badRequest('File uploads are not supported for generic submissions.');
    }

    const input = requestData(ctx);
    const formTag = stringOrUndefined(input.formTag);
    const fullName = stringOrUndefined(input.fullName);
    const phone = phoneOrUndefined(input.phone);
    const email = emailOrUndefined(input.email);
    const preferredDate = dateOrUndefined(input.preferredDate);
    const rateLimit = checkFormSubmissionRateLimit(['generic', ctx.ip, formTag]);

    if (!rateLimit.allowed) {
      ctx.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return ctx.tooManyRequests('Too many form submissions. Please try again later.');
    }

    if (!formTag) return ctx.badRequest('formTag is required.');
    if (!fullName) return ctx.badRequest('fullName is required.');
    if (phone === null) return ctx.badRequest('phone must be a valid phone number.');
    if (email === null) return ctx.badRequest('email must be a valid email address.');
    if (preferredDate === null) return ctx.badRequest('preferredDate must use YYYY-MM-DD format.');

    const form = await strapi.documents(GENERIC_FORM_UID as any).findFirst({
      status: 'published',
      filters: { formTag },
      populate: {
        dynamicFields: true,
      },
    } as any);

    if (!form) return ctx.badRequest('Unknown formTag.');

    const missingField = (form.dynamicFields ?? []).find(
      (field: any) => field.isRequired && !fieldValue(input, field.label)
    );
    if (missingField) return ctx.badRequest(`${missingField.label} is required.`);

    let showroomRef = undefined;
    const preferredShowroomVal = stringOrUndefined(input.showroom) ?? stringOrUndefined(input.preferredShowroom);
    if (preferredShowroomVal) {
      const showroom = await strapi.documents('api::showroom.showroom').findFirst({
        filters: {
          $or: [
            { name: preferredShowroomVal },
            { slug: preferredShowroomVal },
            { documentId: preferredShowroomVal }
          ]
        }
      } as any);
      if (showroom) {
        showroomRef = showroom.documentId;
      }
    }

    const entity = await strapi.documents(GENERIC_SUBMISSION_UID as any).create({
      data: {
        formTag,
        fullName,
        phone,
        email,
        preferredShowroom: showroomRef,
        preferredDate,
        selectedTimeSlot: stringOrUndefined(input.selectedTimeSlot),
        notes: stringOrUndefined(input.notes),
        sourcePage: stringOrUndefined(input.sourcePage),
        consentAccepted: booleanValue(input.consentAccepted),
      },
    } as any);

    return {
      data: {
        id: entity.id,
        documentId: entity.documentId,
        formTag: entity.formTag,
      },
      meta: {},
    };
  },
}));
