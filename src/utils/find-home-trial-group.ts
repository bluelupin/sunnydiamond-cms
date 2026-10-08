import { appointmentGroupScheduleKey, legacyHomeTrialScheduleKey, VIDEO_CALL_FORM_TAGS } from './home-trial-group-key';

const GROUP = 'api::appointment-group.appointment-group';

/** Reuse pre-address keys only when their saved address matches, upgrading under lock. */
export async function findHomeTrialGroup(strapi: any, trx: any, data: any) {
  const { magentoCustomerId, requestedDate, selectedTimeSlot } = data;
  const key = appointmentGroupScheduleKey(magentoCustomerId, requestedDate, selectedTimeSlot, data);
  const legacyKey = VIDEO_CALL_FORM_TAGS.includes(data.formTag) ? key
    : legacyHomeTrialScheduleKey(magentoCustomerId, requestedDate, selectedTimeSlot);
  const table = strapi.db.metadata.get(GROUP).tableName;
  const locked = await strapi.db.connection(table).transacting(trx)
    .whereIn('active_schedule_key', [key, legacyKey]).orderBy('id', 'asc').forUpdate();
  const groups = strapi.documents(GROUP);
  // Prefer a current key if both generations exist.
  for (const row of [...locked].sort((a, b) => Number(b.active_schedule_key === key) - Number(a.active_schedule_key === key))) {
    const group = await groups.findOne({ documentId: row.document_id, populate: { state: true } });
    if (!group || ['Cancelled', 'Closed', 'Visited'].includes(group.workflowStatus)) continue;
    if (appointmentGroupScheduleKey(group.magentoCustomerId, group.requestedDate, group.selectedTimeSlot, group) !== key) continue;
    if (legacyKey !== key && group.activeScheduleKey === legacyKey) {
      await groups.update({ documentId: group.documentId, data: { activeScheduleKey: key } });
      group.activeScheduleKey = key;
    }
    return group;
  }
  return undefined;
}
