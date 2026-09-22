import { factories } from '@strapi/strapi';
import { checkFormSubmissionRateLimit } from '../../../utils/form-submission-rate-limit';
import { requestLocale } from '../../../utils/request-locale';
import { RESCHEDULABLE_FORM_TAGS, validateAppointmentSchedule, validateReschedulingWindow } from '../../../utils/appointment-schedule';
import { HOME_TRIAL_FORM_TAGS } from '../../../utils/home-trial-group-key';
import { createHomeTrialSubmission } from '../../../utils/create-home-trial-submission';
import { mutateHomeTrialGroup } from '../../../utils/mutate-home-trial-group';
import { listCustomerAppointments } from '../../../utils/list-customer-appointments';
import { appointmentCustomerChanges, customerDetailsChanged, customerDetailsSnapshot } from '../../../utils/appointment-customer-details';
import { appointmentNoteChanges } from '../../../utils/appointment-note';
import { notifyRescheduleAfterCommit } from '../../../utils/appointment-reschedule-email';
import { sendStoreVisitConfirmationEmail } from '../../../utils/appointment-confirmation-email';
import { notifyShowroomCancellationAfterCommit } from '../../../utils/showroom-appointment-cancelled-email';

const PRODUCT_SUBMISSION_UID = 'api::product-submission.product-submission';
const PRODUCT_FORM_UID = 'api::product-form.product-form';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const APPOINTMENT_FORM_TAGS = [
...RESCHEDULABLE_FORM_TAGS,
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
    const magentoCustomerId = ctx.state.magentoCustomer?.id;
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

    const form = await strapi.documents(PRODUCT_FORM_UID as any).findFirst({
      status: 'published',
      locale,
      filters: { formTag },
      populate: {
        availableTimeSlots: true,
        showroomOptions: {
          fields: ['documentId', 'city', 'slug'],
        },
      },
    } as any);

    if (!form) return ctx.badRequest('Unknown formTag.');
    if (RESCHEDULABLE_FORM_TAGS.includes(formTag)) {
      const scheduleError = validateAppointmentSchedule(requestedDate, stringOrUndefined(input.selectedTimeSlot), form);
      if (scheduleError) return ctx.badRequest(scheduleError);
    }

    let preferredShowroomRef: string | undefined;
    let preferredShowroomDetails: any;
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
            { city: preferredShowroomValue },
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
      preferredShowroomDetails = preferredShowroom;
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

    const submissionData = {
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
    };
    const grouped = HOME_TRIAL_FORM_TAGS.includes(formTag)
      ? await createHomeTrialSubmission(strapi, submissionData)
      : undefined;
    const entity = grouped?.entity ?? await strapi.documents(PRODUCT_SUBMISSION_UID as any).create({ data: submissionData } as any);

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

    if (formTag === 'product-store-visit') {
      const showroom = preferredShowroomDetails;
      const location = [showroom?.address, showroom?.city, showroom?.state, showroom?.pincode]
        .map(value => stringOrUndefined(value))
        .filter(Boolean)
        .join(', ');
      await sendStoreVisitConfirmationEmail(strapi, {
        documentId: entity.documentId,
        customerName,
        customerEmail,
        requestedDate,
        selectedTimeSlot: stringOrUndefined(input.selectedTimeSlot),
        location: location || showroom?.city || 'Sunny Diamonds showroom',
      });
    }

    return {
      data: {
        id: entity.id,
        documentId: entity.documentId,
        formTag: entity.formTag,
        ...(grouped ? { appointmentGroupId: grouped.groupDocumentId } : {}),
      },
      meta: {},
    };
  },

  async reschedule(ctx) {
    const input = requestData(ctx);
    const documentId = stringOrUndefined(ctx.params.documentId);
    const requestedDate = stringOrUndefined(input.requestedDate);
    const selectedTimeSlot = stringOrUndefined(input.selectedTimeSlot);
    const customerChanges = appointmentCustomerChanges(input);
    if (customerChanges.error) return ctx.badRequest(customerChanges.error);
    const noteChanges = appointmentNoteChanges(input);
    if (noteChanges.error) return ctx.badRequest(noteChanges.error);
    if (!documentId) return ctx.badRequest('Appointment documentId is required.');
    const rateLimit = checkFormSubmissionRateLimit(['reschedule', ctx.ip, documentId]);
    if (!rateLimit.allowed) {
      ctx.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return ctx.tooManyRequests('Too many rescheduling requests. Please try again later.');
    }

    const grouped = ctx.state.magentoCustomer ? await mutateHomeTrialGroup(strapi, {
      documentId, customerId: ctx.state.magentoCustomer?.id, action: 'reschedule',
      requestedDate, selectedTimeSlot, locale: requestLocale(ctx, input),
      customerChanges: customerChanges.data,
      noteChanges: noteChanges.data,
    }) : undefined;
    if (grouped) {
      if (grouped.error) return grouped.status === 404 ? ctx.notFound(grouped.error) : ctx.badRequest(grouped.error);
      return { data: grouped.data, meta: { changed: grouped.changed } };
    }
    // Lock the appointment so concurrent changes record the actual previous schedule.
    const result = await strapi.db.transaction(async ({ trx, onCommit }) => {
      const table = strapi.db.metadata.get(PRODUCT_SUBMISSION_UID).tableName;
      const locked = await strapi.db.connection(table).transacting(trx)
        .where({ document_id: documentId })
        .modify(query => {
          if (ctx.state.magentoCustomer) query.where({ magento_customer_id: ctx.state.magentoCustomer.id });
          else query.where({ form_tag: 'product-store-visit' });
        }).forUpdate().first();
      if (!locked) return { error: 'Appointment not found.', status: 404 };
      const appointment = await strapi.db.query(PRODUCT_SUBMISSION_UID).findOne({
        where: { id: locked.id }, populate: { appointmentGroup: true, preferredShowroom: true },
      });
      if (appointment.appointmentGroup && HOME_TRIAL_FORM_TAGS.includes(appointment.formTag)) {
        return { error: 'Appointment grouping changed. Please retry the request.', status: 409 };
      }
      if (!RESCHEDULABLE_FORM_TAGS.includes(appointment.formTag) && appointment.formTag !== 'product-store-visit') {
        return { error: 'This appointment type cannot be rescheduled.', status: 400 };
      }
      if (['Visited', 'Closed', 'Cancelled'].includes(appointment.workflowStatus)) {
        return { error: 'Completed, closed or cancelled appointments cannot be rescheduled.', status: 400 };
      }
      const windowError = validateReschedulingWindow(appointment.requestedDate);
      if (windowError) return { error: windowError, status: 400 };
      const scheduleChanged = appointment.requestedDate !== requestedDate || appointment.selectedTimeSlot !== selectedTimeSlot;
      if (!scheduleChanged && !customerDetailsChanged([appointment], { ...customerChanges.data, ...noteChanges.data })) {
        return { data: { documentId, requestedDate, selectedTimeSlot }, changed: false };
      }
      if (scheduleChanged) {
        const form = await strapi.documents(PRODUCT_FORM_UID as any).findFirst({
          status: 'published', locale: requestLocale(ctx, input),
          filters: { formTag: appointment.formTag }, populate: { availableTimeSlots: true },
        } as any);
        if (!form) return { error: 'The appointment form is unavailable.', status: 400 };
        const scheduleError = validateAppointmentSchedule(requestedDate, selectedTimeSlot, form);
        if (scheduleError) return { error: scheduleError, status: 400 };
      }
      await strapi.documents(PRODUCT_SUBMISSION_UID as any).update({
        documentId,
        data: {
          requestedDate, selectedTimeSlot,
          ...customerChanges.data,
          ...noteChanges.data,
          rescheduleHistory: [
            ...(Array.isArray(appointment.rescheduleHistory) ? appointment.rescheduleHistory : []),
            {
              previousData: { requestedDate: appointment.requestedDate ?? null, selectedTimeSlot: appointment.selectedTimeSlot ?? null,
                ...(Object.keys(noteChanges.data).length ? { requestDetails: appointment.requestDetails ?? null } : {}),
                ...(Object.keys(customerChanges.data).length ? { customerDetails: [customerDetailsSnapshot(appointment)] } : {}) },
              newData: { requestedDate, selectedTimeSlot,
                ...noteChanges.data,
                ...(Object.keys(customerChanges.data).length ? { customerDetails: [customerDetailsSnapshot(appointment, customerChanges.data)] } : {}) },
              productId: appointment.productId ?? null,
              changedAt: new Date().toISOString(),
            },
          ],
        },
      } as any);
      if (scheduleChanged) notifyRescheduleAfterCommit(strapi, onCommit, {
        ...customerDetailsSnapshot(appointment, customerChanges.data),
        formTag: appointment.formTag, preferredShowroom: appointment.preferredShowroom,
        previousDate: appointment.requestedDate, previousTimeSlot: appointment.selectedTimeSlot,
        requestedDate, selectedTimeSlot,
      });
      return { data: { documentId, requestedDate, selectedTimeSlot, ...customerChanges.data, ...noteChanges.data }, changed: true };
    });
    if (result.error) return result.status === 404 ? ctx.notFound(result.error) : result.status === 409 ? ctx.conflict(result.error) : ctx.badRequest(result.error);
    return { data: result.data, meta: { changed: result.changed } };
  },

  async cancel(ctx) {
    const documentId = stringOrUndefined(ctx.params.documentId);
    if (!documentId) return ctx.badRequest('Appointment documentId is required.');
    const rateLimit = checkFormSubmissionRateLimit(['cancel', ctx.ip, documentId]);
    if (!rateLimit.allowed) {
      ctx.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return ctx.tooManyRequests('Too many cancellation requests. Please try again later.');
    }
    const grouped = ctx.state.magentoCustomer ? await mutateHomeTrialGroup(strapi, {
      documentId, customerId: ctx.state.magentoCustomer?.id, action: 'cancel',
    }) : undefined;
    if (grouped) {
      if (grouped.error) return grouped.status === 404 ? ctx.notFound(grouped.error) : ctx.badRequest(grouped.error);
      return { data: grouped.data, meta: { changed: grouped.changed } };
    }
    const result = await strapi.db.transaction(async ({ trx, onCommit }) => {
      const table = strapi.db.metadata.get(PRODUCT_SUBMISSION_UID).tableName;
      const locked = await strapi.db.connection(table).transacting(trx)
        .where({ document_id: documentId })
        .modify(query => {
          if (ctx.state.magentoCustomer) query.where({ magento_customer_id: ctx.state.magentoCustomer.id });
          else query.where({ form_tag: 'product-store-visit' });
        }).forUpdate().first();
      if (!locked) return { error: 'Appointment not found.', status: 404 };
      const appointment = await strapi.db.query(PRODUCT_SUBMISSION_UID).findOne({
        where: { id: locked.id }, populate: { appointmentGroup: true, preferredShowroom: true },
      });
      if (appointment.appointmentGroup && HOME_TRIAL_FORM_TAGS.includes(appointment.formTag)) {
        return { error: 'Appointment grouping changed. Please retry the request.', status: 409 };
      }
      if (!APPOINTMENT_FORM_TAGS.includes(appointment.formTag)) {
        return { error: 'This submission is not an appointment.', status: 400 };
      }
      const data = { documentId, workflowStatus: 'Cancelled', requestedDate: appointment.requestedDate, selectedTimeSlot: appointment.selectedTimeSlot };
      if (appointment.workflowStatus === 'Cancelled') return { data, changed: false };
      if (['Visited', 'Closed'].includes(appointment.workflowStatus)) {
        return { error: 'Completed or closed appointments cannot be cancelled.', status: 400 };
      }
      await strapi.documents(PRODUCT_SUBMISSION_UID as any).update({
        documentId,
        data: {
          workflowStatus: 'Cancelled',
        },
      } as any);
      if (appointment.formTag === 'product-store-visit') {
        notifyShowroomCancellationAfterCommit(strapi, onCommit, appointment);
      }
      return { data, changed: true };
    });
    if (result.error) return result.status === 404 ? ctx.notFound(result.error) : result.status === 409 ? ctx.conflict(result.error) : ctx.badRequest(result.error);
    return { data: result.data, meta: { changed: result.changed } };
  },

  async customerAppointments(ctx) {
    const locale = requestLocale(ctx);
    const requestedPage = Number(ctx.query.page);
    const requestedPageSize = Number(ctx.query.pageSize);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize =
      Number.isInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, 100)
        : 20;
    return listCustomerAppointments(strapi, {
      customerId: ctx.state.magentoCustomer?.id, page, pageSize, locale,
      formTags: APPOINTMENT_FORM_TAGS,
      guestDocumentId: stringOrUndefined(ctx.query.documentId),
    });
  },
}));
