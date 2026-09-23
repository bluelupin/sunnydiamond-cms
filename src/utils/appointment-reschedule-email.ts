import type { Core } from '@strapi/strapi';
import { recordVideoCallChange } from './video-call-change-log';
import { appointmentRescheduledTemplate, type AppointmentRescheduledData } from '../emails/appointment-rescheduled';
import { showroomAppointmentRescheduledTemplate } from '../emails/showroom-appointment-rescheduled';
import { videoCallRescheduledTemplate } from '../emails/video-call-appointment';
import { appointmentManageUrl } from './video-call-appointment-email';
import { RESCHEDULABLE_FORM_TAGS, validAppointmentDate } from './appointment-schedule';

export interface RescheduleNotification extends AppointmentRescheduledData {
  customerEmail?: string | null;
  appointmentReference?: string | null;
  formTag?: string | null;
  productName?: string | null;
  preferredShowroom?: { city?: string | null; state?: string | null; pincode?: string | null; address?: string | null } | null;
}

const plainText = (value?: string | null) => value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const manageUrl = (documentId: string) => {
  const configured = process.env.APPOINTMENT_MANAGE_URL?.trim();
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.searchParams.set('documentId', documentId);
    return url.toString();
  } catch { return undefined; }
};

export async function sendAppointmentRescheduleEmail(strapi: Core.Strapi, data: RescheduleNotification) {
  if (data.previousDate === data.requestedDate && data.previousTimeSlot === data.selectedTimeSlot) return;
  const to = data.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) return;
  if (!validAppointmentDate(data.requestedDate) || !data.selectedTimeSlot?.trim()) return;
  try {
    const showroom = data.preferredShowroom;
    const template = data.formTag === 'product-store-visit'
      ? showroomAppointmentRescheduledTemplate({
          appointmentId: data.appointmentReference || data.documentId, customerName: data.customerName,
          newDate: data.requestedDate, newTime: data.selectedTimeSlot,
          showroomName: showroom?.city,
          showroomAddress: [plainText(showroom?.address), showroom?.city, showroom?.state, showroom?.pincode]
            .map(value => value?.trim()).filter(Boolean).join(', '),
          manageUrl: manageUrl(data.documentId),
        })
      : data.formTag === 'product-video-call'
        ? videoCallRescheduledTemplate({
            appointmentId: data.appointmentReference || data.documentId, customerName: data.customerName,
            appointmentDate: data.requestedDate, appointmentTime: data.selectedTimeSlot,
            productName: data.productName, manageUrl: appointmentManageUrl(data.documentId),
          })
      : appointmentRescheduledTemplate(data);
    await strapi.plugin('email').service('email').send({
      to, ...template,
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
    return strapi.db.transaction(async ({ onCommit, trx }) => {
      const table = strapi.db.metadata.get(uid).tableName;
      await strapi.db.connection(table).transacting(trx)
        .where({ document_id: context.params.documentId }).forUpdate().first();
      const before = await strapi.db.query(uid).findOne({ where: { documentId: context.params.documentId }, populate: { preferredShowroom: true } });
      const result = await next();
      if (!before || ![...RESCHEDULABLE_FORM_TAGS, 'product-store-visit'].includes(before.formTag)) return result;
      const after = await strapi.db.query(uid).findOne({ where: { documentId: context.params.documentId }, populate: { preferredShowroom: true } });
      await recordVideoCallChange(strapi, before, after, 'Admin');
      if (after && !['Cancelled', 'Closed', 'Visited'].includes(after.workflowStatus)) {
        notifyRescheduleAfterCommit(strapi, onCommit, {
          documentId: after.documentId, customerName: after.customerName, customerEmail: after.customerEmail,
          appointmentReference: after.appointmentReference,
          formTag: after.formTag, preferredShowroom: after.preferredShowroom, productName: after.productName,
          previousDate: before.requestedDate, previousTimeSlot: before.selectedTimeSlot,
          requestedDate: after.requestedDate, selectedTimeSlot: after.selectedTimeSlot,
        });
      }
      return result;
    });
  });
}
