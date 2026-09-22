import type { Core } from '@strapi/strapi';
import { appointmentRescheduledTemplate, type AppointmentRescheduledData } from '../emails/appointment-rescheduled';
import { RESCHEDULABLE_FORM_TAGS, validAppointmentDate } from './appointment-schedule';

export interface RescheduleNotification extends AppointmentRescheduledData {
  customerEmail?: string | null;
}

export async function sendAppointmentRescheduleEmail(strapi: Core.Strapi, data: RescheduleNotification) {
  if (process.env.APPOINTMENT_EMAIL_ENABLED === 'false') return;
  if (data.previousDate === data.requestedDate && data.previousTimeSlot === data.selectedTimeSlot) return;
  const to = data.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) return;
  if (!validAppointmentDate(data.requestedDate) || !data.selectedTimeSlot?.trim()) return;
  try {
    await strapi.plugin('email').service('email').send({
      to, ...appointmentRescheduledTemplate(data),
    });
    strapi.log.info(`Reschedule email accepted by the email provider for appointment ${data.documentId}.`);
  } catch {
    // Do not leak OAuth credentials, customer details or provider request bodies.
    strapi.log.error(`Reschedule email failed for appointment ${data.documentId}; the appointment remains saved.`);
  }
}

/** Best-effort delivery after commit. Rollbacks discard the callback; no automatic retries. */
export function notifyRescheduleAfterCommit(
  strapi: Core.Strapi,
  onCommit: (callback: () => void) => void,
  data: RescheduleNotification,
) {
  if (data.previousDate === data.requestedDate && data.previousTimeSlot === data.selectedTimeSlot) return;
  onCommit(() => { void sendAppointmentRescheduleEmail(strapi, data); });
}

/** Customer endpoints register their own callback; this covers Content Manager saves only. */
export function registerAdminRescheduleEmail(strapi: Core.Strapi) {
  const uid = 'api::product-submission.product-submission';
  strapi.documents.use(async (context, next) => {
    const request = strapi.requestContext.get();
    if (context.uid !== uid || context.action !== 'update' || !request?.state?.user ||
        !request?.request?.url?.startsWith('/content-manager/')) return next();
    return strapi.db.transaction(async ({ onCommit }) => {
      const before = await strapi.db.query(uid).findOne({ where: { documentId: context.params.documentId } });
      const result = await next();
      if (!before || ![...RESCHEDULABLE_FORM_TAGS, 'product-store-visit'].includes(before.formTag)) return result;
      const after = await strapi.db.query(uid).findOne({ where: { documentId: context.params.documentId } });
      if (after && !['Cancelled', 'Closed', 'Visited'].includes(after.workflowStatus)) {
        notifyRescheduleAfterCommit(strapi, onCommit, {
          documentId: after.documentId, customerName: after.customerName, customerEmail: after.customerEmail,
          previousDate: before.requestedDate, previousTimeSlot: before.selectedTimeSlot,
          requestedDate: after.requestedDate, selectedTimeSlot: after.selectedTimeSlot,
        });
      }
      return result;
    });
  });
}
