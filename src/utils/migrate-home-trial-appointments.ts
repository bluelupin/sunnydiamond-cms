import { createHash, randomUUID } from 'node:crypto';
import { HOME_TRIAL_FORM_TAGS } from './home-trial-group-key';
import { retryableGroupRace } from './create-home-trial-submission';

const PRODUCT = 'api::product-submission.product-submission';
const GROUP = 'api::appointment-group.appointment-group';
const CHANGE = 'api::appointment-change.appointment-change';
const object = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);
const trustedId = (value: any) => Number.isSafeInteger(value) && value > 0;
export const legacyAppointmentEventKey = (documentId: string, index: number) =>
  createHash('sha256').update(JSON.stringify(['legacy-appointment-history-v1', documentId, index])).digest('hex');

/** Opt-in backfill. Default is read-only; no historical grouping or identity inference. */
export async function migrateHomeTrialAppointments(strapi: any, { dryRun = true, batchSize = 100 } = {}) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('Migration batchSize must be between 1 and 1000.');
  const report = { dryRun, scanned: 0, groupsCreated: 0, groupsNeeded: 0,
    eventsCreated: 0, eventsNeeded: 0, missingCustomerDocumentIds: [] as string[],
    invalidHistory: [] as { documentId: string; index: number | null; reason: string }[] };
  let cursor = 0;
  // Capture a high-water mark: submissions created during the run belong to normal creation.
  const last = await strapi.db.query(PRODUCT).findOne({ where: {},
    select: ['id'], orderBy: { id: 'desc' } });
  const maxId = last?.id ?? 0;
  while (cursor < maxId) {
    const batch = await strapi.db.query(PRODUCT).findMany({
      where: { id: { $gt: cursor, $lte: maxId } },
      select: ['id'], orderBy: { id: 'asc' }, limit: batchSize,
    });
    if (!batch.length) break;
    for (const candidate of batch) {
      let outcome: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          outcome = await strapi.db.transaction(async ({ trx }: any) => {
            // Only ungrouped rows get a new relation; existing groups are never mutated.
            await strapi.db.connection(strapi.db.metadata.get(PRODUCT).tableName).transacting(trx)
              .where({ id: candidate.id }).forUpdate().first();
            const row = await strapi.db.query(PRODUCT).findOne({ where: { id: candidate.id },
              populate: { appointmentGroup: true, state: true } });
            if (!row) return undefined;
            const customerId = trustedId(row.magentoCustomerId) ? row.magentoCustomerId : null;
            const result = { documentId: row.documentId, missingCustomer: customerId === null,
              groupNeeded: HOME_TRIAL_FORM_TAGS.includes(row.formTag) && !row.appointmentGroup,
              groupCreated: false, eventsNeeded: 0, eventsCreated: 0,
              invalidHistory: [] as { documentId: string; index: number | null; reason: string }[] };
            let group = row.appointmentGroup;
            if (result.groupNeeded && !dryRun) {
              group = await strapi.db.query(GROUP).create({ data: {
                documentId: randomUUID().replace(/-/g, ''), magentoCustomerId: customerId,
                requestedDate: row.requestedDate ?? null, selectedTimeSlot: row.selectedTimeSlot ?? null,
                activeScheduleKey: null, workflowStatus: row.workflowStatus ?? 'New',
                addressLine1: row.addressLine1 ?? null, addressLine2: row.addressLine2 ?? null,
                city: row.city ?? null, pincode: row.pincode ?? null, state: row.state?.id ?? null,
                createdAt: row.createdAt, updatedAt: row.updatedAt,
              } });
              // Relation-only write avoids Strapi's beforeUpdate timestamp lifecycle.
              // Preserve the original row, timestamps and JSON byte-for-byte.
              await strapi.db.entityManager.updateRelations(PRODUCT, row.id,
                { appointmentGroup: group.id }, { transaction: trx });
              result.groupCreated = true;
            }
            if (row.rescheduleHistory != null && !Array.isArray(row.rescheduleHistory)) {
              result.invalidHistory.push({ documentId: row.documentId, index: null, reason: 'History is not an array.' });
            }
            for (const [index, entry] of (Array.isArray(row.rescheduleHistory) ? row.rescheduleHistory : []).entries()) {
              const key = legacyAppointmentEventKey(row.documentId, index);
              if (await strapi.db.query(CHANGE).findOne({ where: { legacyMigrationKey: key }, select: ['id'] })) continue;
              if (!object(entry) || !object(entry.previousData) || !object(entry.newData) ||
                typeof entry.changedAt !== 'string' || !Number.isFinite(Date.parse(entry.changedAt))) {
                result.invalidHistory.push({ documentId: row.documentId, index, reason: 'Missing valid previousData, newData or changedAt.' });
                continue;
              }
              const eventType = entry.eventType ?? 'Rescheduled';
              if (!['Rescheduled', 'Cancelled'].includes(eventType)) {
                result.invalidHistory.push({ documentId: row.documentId, index, reason: 'Unsupported event type.' });
                continue;
              }
              result.eventsNeeded++;
              if (!dryRun) {
                await strapi.db.query(CHANGE).create({ data: {
                  documentId: randomUUID().replace(/-/g, ''), legacyMigrationKey: key,
                  eventType, changedAt: new Date(entry.changedAt).toISOString(), actorType: 'Migration',
                  magentoCustomerId: customerId, previousData: entry.previousData, newData: entry.newData,
                  sourceGroup: group?.id ?? null, targetGroup: group?.id ?? null,
                  affectedSubmissions: [row.id],
                } });
                result.eventsCreated++;
              }
            }
            return result;
          });
          break;
        } catch (error) {
          if (attempt === 2 || !retryableGroupRace(error)) throw error;
        }
      }
      cursor = candidate.id;
      if (!outcome) continue;
      report.scanned++;
      report.groupsNeeded += Number(outcome.groupNeeded);
      report.groupsCreated += Number(outcome.groupCreated);
      report.eventsNeeded += outcome.eventsNeeded;
      report.eventsCreated += outcome.eventsCreated;
      if (outcome.missingCustomer) report.missingCustomerDocumentIds.push(outcome.documentId);
      report.invalidHistory.push(...outcome.invalidHistory);
    }
  }
  return report;
}
