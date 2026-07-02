import { factories } from '@strapi/strapi';
import { checkFormSubmissionRateLimit } from '../../../utils/form-submission-rate-limit';

const PRODUCT_SUBMISSION_UID = 'api::product-submission.product-submission';
const PRODUCT_FORM_UID = 'api::product-form.product-form';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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

const firstFile = (files: any) => {
  const file = files?.uploadedImage;
  return Array.isArray(file) ? file[0] : file;
};

const fileMime = (file: any) => file?.mimetype ?? file?.type;

export default factories.createCoreController(PRODUCT_SUBMISSION_UID as any, ({ strapi }) => ({
  async submit(ctx) {
    const input = requestData(ctx);
    const upload = firstFile(ctx.request.files);
    const formTag = stringOrUndefined(input.formTag);
    const productName = stringOrUndefined(input.productName);
    const customerName = stringOrUndefined(input.customerName);
    const customerPhone = phoneOrUndefined(input.customerPhone);
    const customerEmail = emailOrUndefined(input.customerEmail);
    const requestedDate = dateOrUndefined(input.requestedDate);
    const rateLimit = checkFormSubmissionRateLimit(['product', ctx.ip, formTag]);

    if (!rateLimit.allowed) {
      ctx.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return ctx.tooManyRequests('Too many form submissions. Please try again later.');
    }

    if (!formTag) return ctx.badRequest('formTag is required.');
    if (!productName) return ctx.badRequest('productName is required.');
    if (!customerName) return ctx.badRequest('customerName is required.');
    if (!customerPhone) return ctx.badRequest('customerPhone must be a valid phone number.');
    if (customerEmail === null) return ctx.badRequest('customerEmail must be a valid email address.');
    if (requestedDate === null) return ctx.badRequest('requestedDate must use YYYY-MM-DD format.');

    const form = await strapi.documents(PRODUCT_FORM_UID as any).findFirst({
      status: 'published',
      filters: { formTag },
    } as any);

    if (!form) return ctx.badRequest('Unknown formTag.');

    if (ctx.request.files && Object.keys(ctx.request.files).length > 0 && !upload) {
      return ctx.badRequest('Only uploadedImage file uploads are supported.');
    }

    if (upload) {
      if (!form.allowImageUpload) return ctx.badRequest('Image upload is not enabled for this formTag.');
      if (!fileMime(upload)?.startsWith('image/')) return ctx.badRequest('uploadedImage must be an image file.');
      if (upload.size && upload.size > MAX_UPLOAD_BYTES) return ctx.badRequest('uploadedImage must be 5MB or smaller.');
    }

    let stateRef = undefined;
    const stateVal = stringOrUndefined(input.stateName) ?? stringOrUndefined(input.state);
    if (stateVal) {
      const stateObj = await strapi.documents('api::state.state').findFirst({
        filters: {
          $or: [
            { name: stateVal },
            { code: stateVal },
            { documentId: stateVal }
          ]
        }
      } as any);
      if (stateObj) {
        stateRef = stateObj.documentId;
      }
    }

    const entity = await strapi.documents(PRODUCT_SUBMISSION_UID as any).create({
      data: {
        formTag,
        productName,
        productId: stringOrUndefined(input.productId),
        customerName,
        customerPhone,
        customerEmail,
        requestedDate,
        selectedTimeSlot: stringOrUndefined(input.selectedTimeSlot),
        requestDetails: stringOrUndefined(input.requestDetails),
        addressLine1: stringOrUndefined(input.addressLine1),
        addressLine2: stringOrUndefined(input.addressLine2),
        pincode: stringOrUndefined(input.pincode),
        city: stringOrUndefined(input.city),
        state: stateRef,
        sourcePage: stringOrUndefined(input.sourcePage),
        utmSource: stringOrUndefined(input.utmSource),
        utmMedium: stringOrUndefined(input.utmMedium),
        utmCampaign: stringOrUndefined(input.utmCampaign),
        consentAccepted: booleanValue(input.consentAccepted),
      },
    } as any);

    if (upload) {
      await strapi.plugin('upload').service('upload').upload({
        data: {
          ref: PRODUCT_SUBMISSION_UID,
          refId: entity.id,
          field: 'uploadedImage',
        },
        files: upload,
      });
    }

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
