import type { Core } from '@strapi/strapi';

const videoTags = ['schedule-video-call', 'product-video-call'];
const snapshot = (row: any) => ({
  documentId: row.documentId, appointmentReference: row.appointmentReference ?? null,
  formTag: row.formTag, productId: row.productId ?? null, productName: row.productName ?? null,
  requestedDate: row.requestedDate ?? null, selectedTimeSlot: row.selectedTimeSlot ?? null,
  workflowStatus: row.workflowStatus ?? null, requestDetails: row.requestDetails ?? null,
  customerName: row.customerName ?? null, customerEmail: row.customerEmail ?? null,
  customerPhone: row.customerPhone ?? null,
});

/** Must run in the same transaction as the appointment update. No-op saves produce no log. */
export async function recordVideoCallChange(strapi: Core.Strapi, before: any, after: any,
  actorType: 'Customer' | 'Admin') {
  if (!before || !after || !videoTags.includes(before.formTag)) return;
  const cancelled = before.workflowStatus !== 'Cancelled' && after.workflowStatus === 'Cancelled';
  const rescheduled = !['Cancelled', 'Closed', 'Visited'].includes(after.workflowStatus) &&
    (before.requestedDate !== after.requestedDate || before.selectedTimeSlot !== after.selectedTimeSlot);
  if (!cancelled && !rescheduled) return;
  await strapi.documents('api::appointment-change.appointment-change').create({ data: {
    eventType: cancelled ? 'Cancelled' : 'Rescheduled', changedAt: new Date().toISOString(), actorType,
    magentoCustomerId: before.magentoCustomerId ?? null,
    previousData: snapshot(before), newData: snapshot(after),
    affectedSubmissions: { connect: [before.documentId] },
  } } as any);
}
