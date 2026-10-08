import { VIDEO_CALL_FORM_TAGS, appointmentGroupScheduleKey } from './home-trial-group-key';
import { findHomeTrialGroup } from './find-home-trial-group';
import { assignAppointmentReference } from './appointment-reference';
import { countScheduleChanges } from './appointment-schedule';

const PRODUCT = 'api::product-submission.product-submission';
const GROUP = 'api::appointment-group.appointment-group';
const CHANGE = 'api::appointment-change.appointment-change';

/** Adopt old same-slot bookings inside the group mutation transaction, without sending email. */
export async function groupExistingVideoCalls(strapi: any, trx: any, initial: any) {
  const table = strapi.db.metadata.get(PRODUCT).tableName;
  await strapi.db.connection(table).transacting(trx)
    .where({ magento_customer_id: initial.magentoCustomerId }).orderBy('id', 'asc').forUpdate();
  const current = await strapi.db.query(PRODUCT).findOne({
    where: { documentId: initial.documentId, magentoCustomerId: initial.magentoCustomerId },
    populate: { appointmentGroup: true },
  });
  if (current?.appointmentGroup || !current || ['Cancelled', 'Closed', 'Visited'].includes(current.workflowStatus)) return;
  const rows = await strapi.db.query(PRODUCT).findMany({
    where: { magentoCustomerId: current.magentoCustomerId, formTag: { $in: VIDEO_CALL_FORM_TAGS },
      requestedDate: current.requestedDate, selectedTimeSlot: current.selectedTimeSlot,
      workflowStatus: { $in: ['New', 'Contacted', 'Scheduled'] }, appointmentGroup: { $null: true } },
    orderBy: { id: 'asc' },
  });
  if (!rows.length) return;
  const priorRescheduleCount = Math.max(...rows.map((row: any) => countScheduleChanges(row.rescheduleHistory)));
  const groups = strapi.documents(GROUP);
  let group = await findHomeTrialGroup(strapi, trx, current);
  if (!group) {
    group = await groups.create({ data: {
      formTag: current.formTag, magentoCustomerId: current.magentoCustomerId,
      requestedDate: current.requestedDate, selectedTimeSlot: current.selectedTimeSlot,
      workflowStatus: current.workflowStatus,
      priorRescheduleCount,
      activeScheduleKey: appointmentGroupScheduleKey(current.magentoCustomerId, current.requestedDate, current.selectedTimeSlot, current),
    } });
    group.appointmentReference = await assignAppointmentReference(strapi, GROUP, group, 'VC');
  } else if (priorRescheduleCount > (group.priorRescheduleCount ?? 0)) {
    const changes = await strapi.db.query(CHANGE).findMany({ where: {
      sourceGroup: { documentId: group.documentId }, eventType: 'Rescheduled', actorType: { $in: ['Customer', 'Migration'] },
    }, select: ['previousData', 'newData'] });
    const carriedCount = Math.max(group.priorRescheduleCount ?? 0, priorRescheduleCount - countScheduleChanges(changes));
    await groups.update({ documentId: group.documentId, data: { priorRescheduleCount: carriedCount } });
  }
  for (const row of rows) {
    await strapi.documents(PRODUCT).update({ documentId: row.documentId, data: {
      appointmentGroup: group.documentId, appointmentReference: group.appointmentReference,
      workflowStatus: group.workflowStatus,
    } });
  }
}
