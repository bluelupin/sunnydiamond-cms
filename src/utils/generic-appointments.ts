import { countScheduleChanges, MAX_RESCHEDULES, RESCHEDULE_LIMIT_MESSAGE,
  validateAppointmentSchedule, validateReschedulingWindow } from './appointment-schedule';
import { recordVideoCallChange } from './video-call-change-log';
import { requestLocale } from './request-locale';
import { notifyRescheduleAfterCommit } from './appointment-reschedule-email';
import { notifyShowroomCancellationAfterCommit } from './showroom-appointment-cancelled-email';

export const GENERIC_APPOINTMENT_UID = 'api::generic-submission.generic-submission';
const notificationData = (row: any) => ({
  ...row, customerName: row.fullName, customerEmail: row.email, requestedDate: row.preferredDate,
});

function notifyGenericAppointmentChange(strapi: any, onCommit: any, before: any, after: any) {
  if (!before || !after || before.formTag !== 'book-an-appointment') return;
  if (before.workflowStatus !== 'Cancelled' && after.workflowStatus === 'Cancelled') {
    notifyShowroomCancellationAfterCommit(strapi, onCommit, notificationData(after));
  } else if (!['Cancelled', 'Closed', 'Visited'].includes(after.workflowStatus)) {
    notifyRescheduleAfterCommit(strapi, onCommit, {
      ...notificationData(after), previousDate: before.preferredDate, previousTimeSlot: before.selectedTimeSlot,
    });
  }
}
export const genericAppointmentView = (row: any) => ({
  documentId: row.documentId, appointmentReference: row.appointmentReference,
  appointmentId: row.appointmentReference ?? row.documentId, appointmentGroupId: null,
  formTag: row.formTag, customerName: row.fullName, customerPhone: row.phone, customerEmail: row.email,
  requestedDate: row.preferredDate, selectedTimeSlot: row.selectedTimeSlot, workflowStatus: row.workflowStatus,
  requestDetails: row.notes, purposeOfVisit: row.reasonForContact, preferredShowroom: row.preferredShowroom,
  createdAt: row.createdAt, updatedAt: row.updatedAt, products: [],
  rescheduleCount: countScheduleChanges(row.rescheduleHistory),
  reschedulesLeft: Math.max(0, MAX_RESCHEDULES - countScheduleChanges(row.rescheduleHistory)),
  ...(row.workflowStatus === 'Cancelled' ? { cancelledAt: (row.rescheduleHistory ?? [])
    .filter((entry: any) => entry.eventType === 'Cancelled').at(-1)?.changedAt ?? null } : {}),
});

/** Called by authenticated customer endpoints; a missing generic booking falls through to products. */
export async function mutateGenericAppointment(strapi: any, ctx: any, action: 'cancel' | 'reschedule', input: any = {}) {
  const documentId = ctx.params.documentId;
  const where = { documentId, magentoCustomerId: ctx.state.magentoCustomer.id, formTag: 'book-an-appointment' };
  if (!await strapi.db.query(GENERIC_APPOINTMENT_UID).findOne({ where, select: ['id'] })) return undefined;
  return strapi.db.transaction(async ({ trx, onCommit }) => {
    const table = strapi.db.metadata.get(GENERIC_APPOINTMENT_UID).tableName;
    const locked = await strapi.db.connection(table).transacting(trx)
      .where({ document_id: documentId, magento_customer_id: ctx.state.magentoCustomer.id }).forUpdate().first();
    if (!locked) return { error: 'Appointment not found.', status: 404 };
    const before = await strapi.db.query(GENERIC_APPOINTMENT_UID).findOne({ where: { ...where, id: locked.id }, populate: { preferredShowroom: true } });
    if (!before) return { error: 'Appointment not found.', status: 404 };
    if (action === 'cancel' && before.workflowStatus === 'Cancelled') return { data: genericAppointmentView(before), meta: { changed: false } };
    if (['Visited', 'Closed', 'Cancelled'].includes(before.workflowStatus)) return { error: 'Completed, closed or cancelled appointments cannot be changed.' };
    const data: any = action === 'cancel' ? { workflowStatus: 'Cancelled' } : {
      preferredDate: input.preferredDate ?? input.requestedDate ?? before.preferredDate,
      selectedTimeSlot: input.selectedTimeSlot ?? before.selectedTimeSlot,
    };
    if (action === 'reschedule') {
      const error = validateReschedulingWindow(before.preferredDate, before.selectedTimeSlot, before.formTag);
      if (error) return { error };
      if (data.preferredDate === before.preferredDate && data.selectedTimeSlot === before.selectedTimeSlot) {
        return { data: genericAppointmentView(before), meta: { changed: false } };
      }
      if (countScheduleChanges(before.rescheduleHistory) >= MAX_RESCHEDULES) return { error: RESCHEDULE_LIMIT_MESSAGE };
      const form = await strapi.documents('api::generic-form.generic-form').findFirst({
        status: 'published', locale: requestLocale(ctx, input), filters: { formTag: before.formTag }, populate: { availableTimeSlots: true },
      });
      if (!form) return { error: 'The appointment form is unavailable.' };
      const scheduleError = validateAppointmentSchedule(data.preferredDate, data.selectedTimeSlot, form);
      if (scheduleError) return { error: scheduleError };
    }
    const after = { ...before, ...data };
    data.rescheduleHistory = [...(Array.isArray(before.rescheduleHistory) ? before.rescheduleHistory : []), {
      eventType: action === 'cancel' ? 'Cancelled' : 'Rescheduled', changedAt: new Date().toISOString(),
      previousData: { requestedDate: before.preferredDate, selectedTimeSlot: before.selectedTimeSlot },
      newData: { requestedDate: after.preferredDate, selectedTimeSlot: after.selectedTimeSlot },
    }];
    await strapi.documents(GENERIC_APPOINTMENT_UID).update({ documentId, data });
    await recordVideoCallChange(strapi, before, after, 'Customer');
    notifyGenericAppointmentChange(strapi, onCommit, before, after);
    return { data: genericAppointmentView({ ...after, rescheduleHistory: data.rescheduleHistory }), meta: { changed: true } };
  });
}

export async function linkGuestGenericAppointments(strapi: any, customer: { id: number; email?: string }) {
  if (!customer.email) return;
  await strapi.db.connection(strapi.db.metadata.get(GENERIC_APPOINTMENT_UID).tableName)
    .where('form_tag', 'book-an-appointment').whereNull('magento_customer_id')
    .whereRaw('LOWER(TRIM(??)) = ?', ['email', customer.email.trim().toLowerCase()])
    .update({ magento_customer_id: customer.id });
}

export function registerGenericAppointmentHistory(strapi: any) {
  strapi.documents.use(async (context: any, next: any) => {
    const request = strapi.requestContext.get();
    if (context.uid !== GENERIC_APPOINTMENT_UID || context.action !== 'update' ||
        !request?.state?.user || !request?.request?.url?.startsWith('/content-manager/')) return next();
    return strapi.db.transaction(async ({ trx, onCommit }: any) => {
      await strapi.db.connection(strapi.db.metadata.get(GENERIC_APPOINTMENT_UID).tableName).transacting(trx)
        .where({ document_id: context.params.documentId }).forUpdate().first();
      const before = await strapi.db.query(GENERIC_APPOINTMENT_UID).findOne({ where: { documentId: context.params.documentId }, populate: { preferredShowroom: true } });
      const result = await next();
      const after = await strapi.db.query(GENERIC_APPOINTMENT_UID).findOne({ where: { documentId: context.params.documentId }, populate: { preferredShowroom: true } });
      await recordVideoCallChange(strapi, before, after, 'Admin');
      notifyGenericAppointmentChange(strapi, onCommit, before, after);
      return result;
    });
  });
}
