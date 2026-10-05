import { validateGenericAppointmentSchedule, resolveGenericAppointmentSlot } from '../../../utils/generic-appointment-schedule';
import { assignAppointmentReference } from '../../../utils/appointment-reference';
import { fieldValue } from '../../../utils/generic-form-input';
import { factories } from '@strapi/strapi';
import { checkFormSubmissionRateLimit, clientIp } from '../../../utils/form-submission-rate-limit';
import { requestLocale } from '../../../utils/request-locale';
import { sendReachOutConfirmationEmail } from '../../../utils/reach-out-confirmation-email';
import { sendBookAppointmentConfirmationEmail } from '../../../utils/appointment-confirmation-email';

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


export default factories.createCoreController(GENERIC_SUBMISSION_UID as any, ({ strapi }) => ({
  async create(ctx) {
    // Website clients also post bookings to the standard collection endpoint.
    if (stringOrUndefined(requestData(ctx).formTag) === 'book-an-appointment') {
      return this.submit(ctx, undefined);
    }
    return super.create(ctx);
  },

  async submit(ctx) {
    if (ctx.request.files && Object.keys(ctx.request.files).length > 0) {
      return ctx.badRequest('File uploads are not supported for generic submissions.');
    }

    const input = requestData(ctx);
    const locale = requestLocale(ctx, input);
    const formTag = stringOrUndefined(input.formTag);
    const fullName = stringOrUndefined(input.fullName);
    const phone = phoneOrUndefined(input.phone);
    const email = emailOrUndefined(input.email);
    const preferredDate = dateOrUndefined(input.preferredDate);
    let selectedTimeSlot = stringOrUndefined(input.selectedTimeSlot);
    const consentAccepted = booleanValue(input.consentAccepted);
    const rateLimit = checkFormSubmissionRateLimit(['generic', clientIp(ctx), formTag]);

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
      locale,
      filters: { formTag },
      populate: {
        dynamicFields: { populate: { dropdownOptions: true } }, availableTimeSlots: true, showrooms: true,
      },
    } as any);

    if (!form) return ctx.badRequest('Unknown formTag.');
    if (formTag === 'book-an-appointment') {
      if (!phone || !email) return ctx.badRequest('A valid phone and email are required for appointments.');
      const error = validateGenericAppointmentSchedule(preferredDate, stringOrUndefined(input.selectedTimeSlot), form);
      if (error) return ctx.badRequest(error);
      selectedTimeSlot = resolveGenericAppointmentSlot(selectedTimeSlot, form) as string;
    }

    const missingField = (form.dynamicFields ?? []).find(
      (field: any) => field.isRequired && !fieldValue(input, field.label)
    );
    if (missingField) return ctx.badRequest(`${missingField.label} is required.`);
    if (form.requiresConsent && !consentAccepted) {
      return ctx.badRequest('consentAccepted must be true.');
    }

    let showroomRef = undefined;
    let showroomDetails: any;
    const preferredShowroomVal = stringOrUndefined(input.showroom) ?? stringOrUndefined(input.preferredShowroom);
    if (preferredShowroomVal) {
      const showroom = await strapi.documents('api::showroom.showroom').findFirst({
        status: 'published',
        locale,
        filters: {
          $or: [
            { city: preferredShowroomVal },
            { slug: preferredShowroomVal },
            { documentId: preferredShowroomVal }
          ]
        }
      } as any);
      if (formTag === 'book-an-appointment' && (!showroom ||
          (form.showrooms?.length && !form.showrooms.some((item: any) => item.documentId === showroom.documentId)))) {
        return ctx.badRequest('preferredShowroom must reference a showroom available for this form.');
      }
      if (showroom) {
        showroomRef = showroom.documentId;
        showroomDetails = showroom;
      }
    }

    const entity = await strapi.documents(GENERIC_SUBMISSION_UID as any).create({
      data: {
        formTag,
        fullName,
        ...(formTag === 'book-an-appointment' ? { magentoCustomerId: ctx.state.magentoCustomer?.id } : {}),
        phone,
        email,
        preferredShowroom: showroomRef,
        preferredDate,
        selectedTimeSlot,
        notes: stringOrUndefined(input.notes) ?? stringOrUndefined(input.message),
        reasonForContact: stringOrUndefined(input.reasonForContact) ?? stringOrUndefined(input.reason),
        sourcePage: stringOrUndefined(input.sourcePage),
        consentAccepted,
      },
    } as any);

    const appointmentId = formTag === 'book-an-appointment'
      ? await assignAppointmentReference(strapi, GENERIC_SUBMISSION_UID, entity, 'BA') : undefined;
    if (formTag === 'book-an-appointment') {
      const location = [showroomDetails?.address, showroomDetails?.city, showroomDetails?.state, showroomDetails?.pincode]
        .map(value => stringOrUndefined(value))
        .filter(Boolean)
        .join(', ');
      await sendBookAppointmentConfirmationEmail(strapi, {
        documentId: entity.documentId,
        appointmentReference: appointmentId,
        customerName: fullName,
        customerEmail: email,
        requestedDate: preferredDate,
        selectedTimeSlot,
        location,
      });
    }
    if (formTag === 'reach-out-to-us') {
      await sendReachOutConfirmationEmail(strapi, {
        documentId: entity.documentId,
        customerName: fullName,
        customerEmail: email,
      });
    }

    return {
      data: {
        id: entity.id,
        documentId: entity.documentId,
        formTag: entity.formTag,
        ...(appointmentId ? { appointmentId } : {}),
      },
      meta: {},
    };
  },
}));
