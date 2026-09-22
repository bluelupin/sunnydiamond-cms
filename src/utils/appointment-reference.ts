import type { Core } from '@strapi/strapi';

const PRODUCT = 'api::product-submission.product-submission';
const GROUP = 'api::appointment-group.appointment-group';

export function buildAppointmentReference(prefix: 'TAH' | 'SV' | 'VC', id: number, createdAt?: string | Date | null) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('A persisted appointment ID is required.');
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getUTCFullYear() : date.getUTCFullYear();
  return `${prefix}-${year}-${String(id).padStart(6, '0')}`;
}

export async function assignAppointmentReference(strapi: Core.Strapi, uid: string, record: any, prefix: 'TAH' | 'SV' | 'VC') {
  if (record.appointmentReference) return record.appointmentReference;
  const appointmentReference = buildAppointmentReference(prefix, record.id, record.createdAt);
  await strapi.documents(uid as any).update({ documentId: record.documentId, data: { appointmentReference } } as any);
  return appointmentReference;
}

/** Idempotently gives historical customer appointments a readable public reference. */
export async function backfillAppointmentReferences(strapi: Core.Strapi) {
  const [groups, storeVisits] = await Promise.all([
    strapi.db.query(GROUP).findMany({ where: { appointmentReference: { $null: true } }, select: ['id', 'documentId', 'createdAt'] }),
    strapi.db.query(PRODUCT).findMany({ where: { formTag: 'product-store-visit', appointmentReference: { $null: true } },
      select: ['id', 'documentId', 'createdAt'] }),
  ]);
  for (const group of groups) await assignAppointmentReference(strapi, GROUP, group, 'TAH');
  for (const visit of storeVisits) await assignAppointmentReference(strapi, PRODUCT, visit, 'SV');
  if (groups.length || storeVisits.length) {
    strapi.log.info(`Appointment references backfilled: ${groups.length} Try at Home, ${storeVisits.length} showroom visits.`);
  }
}
