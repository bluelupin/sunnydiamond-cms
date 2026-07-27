import { factories } from '@strapi/strapi';
import { checkFormSubmissionRateLimit } from '../../../utils/form-submission-rate-limit';
import {
  bearerToken,
  MagentoCustomerUnauthorizedError,
  resolveMagentoCustomer,
} from '../../../utils/magento-customer';
import { requestLocale } from '../../../utils/request-locale';

const PRODUCT_SUBMISSION_UID = 'api::product-submission.product-submission';
const PRODUCT_FORM_UID = 'api::product-form.product-form';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const APPOINTMENT_FORM_TAGS = [
'product-video-call',
'product-personalisation',
'try-at-home-form',
'product-store-visit'
];

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
    const locale = requestLocale(ctx, input);
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

    let magentoCustomerId: number | undefined;
    const token = bearerToken(ctx.request.headers.authorization);
    if (token) {
      try {
        magentoCustomerId = (await resolveMagentoCustomer(token)).id;
      } catch (error) {
        if (error instanceof MagentoCustomerUnauthorizedError) {
          return ctx.unauthorized(error.message);
        }

        strapi.log.error(
          `Magento customer resolution failed during product submission: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
        return ctx.throw(503, 'Customer authentication is temporarily unavailable.');
      }
    }

    const form = await strapi.documents(PRODUCT_FORM_UID as any).findFirst({
      status: 'published',
      locale,
      filters: { formTag },
      populate: {
        showroomOptions: {
          fields: ['documentId', 'name', 'slug'],
        },
      },
    } as any);

    if (!form) return ctx.badRequest('Unknown formTag.');

    let preferredShowroomRef: string | undefined;
    const preferredShowroomValue =
      stringOrUndefined(input.preferredShowroom) ??
      stringOrUndefined(input.showroomDocumentId) ??
      stringOrUndefined(input.storeVisiting);

    if (preferredShowroomValue) {
      const preferredShowroom = await strapi.documents('api::showroom.showroom').findFirst({
        status: 'published',
        locale,
        filters: {
          $or: [
            { documentId: preferredShowroomValue },
            { slug: preferredShowroomValue },
            { name: preferredShowroomValue },
          ],
        },
      } as any);

      if (!preferredShowroom) {
        return ctx.badRequest('preferredShowroom must reference a published showroom.');
      }

      const configuredShowrooms = Array.isArray(form.showroomOptions)
        ? form.showroomOptions
        : [];
      if (
        configuredShowrooms.length > 0 &&
        !configuredShowrooms.some(
          (showroom: any) => showroom.documentId === preferredShowroom.documentId
        )
      ) {
        return ctx.badRequest('preferredShowroom is not available for this form.');
      }

      preferredShowroomRef = preferredShowroom.documentId;
    }

    if (formTag === 'product-store-visit' && !preferredShowroomRef) {
      return ctx.badRequest('preferredShowroom is required for product-store-visit.');
    }

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
        magentoCustomerId,
        requestedDate,
        selectedTimeSlot: stringOrUndefined(input.selectedTimeSlot),
        requestDetails: stringOrUndefined(input.requestDetails),
        addressLine1: stringOrUndefined(input.addressLine1),
        addressLine2: stringOrUndefined(input.addressLine2),
        pincode: stringOrUndefined(input.pincode),
        city: stringOrUndefined(input.city),
        state: stateRef,
        preferredShowroom: preferredShowroomRef,
        sourcePage: stringOrUndefined(input.sourcePage),
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

  async customerAppointments(ctx) {
    const locale = requestLocale(ctx);
    const magentoCustomerId = ctx.state.magentoCustomer.id;
    const requestedPage = Number(ctx.query.page);
    const requestedPageSize = Number(ctx.query.pageSize);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize =
      Number.isInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, 100)
        : 20;
    const filters = {
      magentoCustomerId,
      formTag: { $in: APPOINTMENT_FORM_TAGS },
    };

    const documentService = strapi.documents(PRODUCT_SUBMISSION_UID as any);
    const [appointments, total] = await Promise.all([
      documentService.findMany({
        filters,
        fields: [
          'documentId',
          'formTag',
          'productName',
          'productId',
          'customerName',
          'customerPhone',
          'customerEmail',
          'requestedDate',
          'selectedTimeSlot',
          'workflowStatus',
          'addressLine1',
          'addressLine2',
          'pincode',
          'city',
          'createdAt',
          'updatedAt',
        ],
        populate: {
          state: {
            fields: ['documentId', 'name', 'code'],
          },
          preferredShowroom: {
            fields: ['documentId', 'name', 'slug', 'city', 'state'],
          },
        },
        sort: ['createdAt:desc'],
        pagination: { page, pageSize },
      } as any),
      documentService.count({ filters } as any),
    ]);

    const localizedAppointments = await Promise.all(
      appointments.map(async (appointment: any) => {
        const showroomDocumentId = appointment.preferredShowroom?.documentId;
        if (!showroomDocumentId || !locale) return appointment;

        const preferredShowroom = await strapi.documents('api::showroom.showroom').findOne({
          documentId: showroomDocumentId,
          status: 'published',
          locale,
          fields: ['documentId', 'name', 'slug', 'city', 'state'],
        } as any);

        return {
          ...appointment,
          preferredShowroom: preferredShowroom ?? appointment.preferredShowroom,
        };
      })
    );

    return {
      data: localizedAppointments,
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
          total,
        },
      },
    };
  },
}));
