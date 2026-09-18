import { HOME_TRIAL_FORM_TAGS, homeTrialScheduleKey } from './home-trial-group-key';
import { customerContactDetails } from './appointment-customer-details';

const GROUP_UID = 'api::appointment-group.appointment-group';
const SUBMISSION_UID = 'api::product-submission.product-submission';

export const retryableGroupRace = (error: any) => {
  const code = error?.code ?? error?.original?.code ?? error?.cause?.code;
  if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', '23505', '40001', '40P01', 'SQLITE_BUSY'].includes(code)) return true;
  return error?.name === 'ValidationError' && error?.details?.errors?.some((item: any) =>
    item.path?.includes('activeScheduleKey'));
};

/** Called only with a customer ID resolved by the Magento policy. */
export async function createHomeTrialSubmission(strapi: any, data: any) {
  if (!HOME_TRIAL_FORM_TAGS.includes(data.formTag)) throw new Error('Only home-trial submissions may join appointment groups.');
  const key = homeTrialScheduleKey(data.magentoCustomerId, data.requestedDate, data.selectedTimeSlot);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await strapi.db.transaction(async ({ trx }: any) => {
        const table = strapi.db.metadata.get(GROUP_UID).tableName;
        const locked = await strapi.db.connection(table).transacting(trx)
          .where({ active_schedule_key: key }).forUpdate().first();
        const groups = strapi.documents(GROUP_UID);
        let group = locked
          ? await groups.findOne({ documentId: locked.document_id, populate: { state: true } })
          : undefined;
        if (!group) {
          group = await groups.create({ data: {
            magentoCustomerId: data.magentoCustomerId,
            requestedDate: data.requestedDate, selectedTimeSlot: data.selectedTimeSlot,
            activeScheduleKey: key, workflowStatus: 'New',
            addressLine1: data.addressLine1, addressLine2: data.addressLine2,
            city: data.city, pincode: data.pincode, state: data.state,
          } });
        }
        if (group.magentoCustomerId !== data.magentoCustomerId ||
          group.requestedDate !== data.requestedDate || group.selectedTimeSlot !== data.selectedTimeSlot ||
          ['Cancelled', 'Closed', 'Visited'].includes(group.workflowStatus)) {
          throw new Error('Appointment group does not match its active schedule key.');
        }
        const firstProduct = await strapi.db.query(SUBMISSION_UID).findOne({
          where: { appointmentGroup: { documentId: group.documentId } }, orderBy: { id: 'asc' },
        });
        const entity = await strapi.documents(SUBMISSION_UID).create({ data: {
          ...data,
          ...(firstProduct ? customerContactDetails(firstProduct) : {}),
          appointmentGroup: group.documentId,
          requestedDate: group.requestedDate, selectedTimeSlot: group.selectedTimeSlot,
          workflowStatus: group.workflowStatus,
          addressLine1: group.addressLine1 ?? null, addressLine2: group.addressLine2 ?? null,
          city: group.city ?? null, pincode: group.pincode ?? null,
          state: locked ? group.state?.documentId ?? null : data.state ?? null,
        } });
        return { entity, groupDocumentId: group.documentId };
      });
    } catch (error) {
      // Retry the whole transaction, never a failed statement inside an aborted transaction.
      if (attempt === 2 || !retryableGroupRace(error)) throw error;
    }
  }
  throw new Error('Could not create the home-trial submission.');
}
