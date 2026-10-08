import type { Core } from '@strapi/strapi';
import { productVariantSnapshot } from './product-variant-details';
import { appointmentAddressChanged, appointmentAddressSnapshot } from './appointment-address';

const loggedFormTags = ['book-an-appointment', 'schedule-video-call', 'product-video-call', 'product-store-visit', 'store-visit', 'try-at-home', 'try-at-home-form'];
const snapshot = (row: any) => ({
  documentId: row.documentId, appointmentReference: row.appointmentReference ?? null,
  formTag: row.formTag, productId: row.productId ?? null, productName: row.productName ?? null,
  ...productVariantSnapshot(row),
  requestedDate: row.requestedDate ?? null, selectedTimeSlot: row.selectedTimeSlot ?? null,
  workflowStatus: row.workflowStatus ?? null, requestDetails: row.requestDetails ?? null,
  customerName: row.customerName ?? null, customerEmail: row.customerEmail ?? null,
  customerPhone: row.customerPhone ?? null,
  ...appointmentAddressSnapshot(row),
});

/** Must run in the same transaction as the appointment update. No-op saves produce no log. */
export async function recordVideoCallChange(strapi: Core.Strapi, before: any, after: any,
  actorType: 'Customer' | 'Admin') {
  if (!before || !after || !loggedFormTags.includes(before.formTag)) return;
  const generic = before.formTag === 'book-an-appointment';
  if (generic) {
    const normalize = (row: any) => ({ ...row, requestedDate: row.preferredDate, customerName: row.fullName,
      customerPhone: row.phone, customerEmail: row.email, requestDetails: row.notes });
    before = normalize(before); after = normalize(after);
  }
  const cancelled = before.workflowStatus !== 'Cancelled' && after.workflowStatus === 'Cancelled';
  const rescheduled = !['Cancelled', 'Closed', 'Visited'].includes(after.workflowStatus) &&
    (before.requestedDate !== after.requestedDate || before.selectedTimeSlot !== after.selectedTimeSlot || appointmentAddressChanged(before, after));
  if (!cancelled && !rescheduled) return;
  await strapi.documents('api::appointment-change.appointment-change').create({ data: {
    eventType: cancelled ? 'Cancelled' : 'Rescheduled', changedAt: new Date().toISOString(), actorType,
    magentoCustomerId: before.magentoCustomerId ?? null,
    previousData: snapshot(before), newData: snapshot(after),
    ...(generic ? { affectedGenericSubmissions: { connect: [before.documentId] } } : { affectedSubmissions: { connect: [before.documentId] } }),
  } } as any);
}
