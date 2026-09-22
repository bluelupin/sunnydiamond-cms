import { HOME_TRIAL_FORM_TAGS, homeTrialScheduleKey } from './home-trial-group-key';
import { validateAppointmentSchedule, validateReschedulingWindow } from './appointment-schedule';
import { retryableGroupRace } from './create-home-trial-submission';
import { customerContactDetails, customerDetailsChanged, customerDetailsSnapshot } from './appointment-customer-details';
import { notifyTryAtHomeChangeAfterCommit } from './try-at-home-change-email';

const GROUP = 'api::appointment-group.appointment-group';
const PRODUCT = 'api::product-submission.product-submission';
const CHANGE = 'api::appointment-change.appointment-change';
const inactive = (row: any) => ['Cancelled', 'Closed', 'Visited'].includes(row.workflowStatus);
const canonical = (group: any) => ({
  requestedDate: group.requestedDate, selectedTimeSlot: group.selectedTimeSlot,
  workflowStatus: group.workflowStatus,
  addressLine1: group.addressLine1 ?? null, addressLine2: group.addressLine2 ?? null,
  city: group.city ?? null, pincode: group.pincode ?? null,
  state: group.state?.documentId ?? null,
});

/** Undefined means a legacy/ungrouped submission; its existing handler remains responsible. */
export async function mutateHomeTrialGroup(strapi: any, input: any): Promise<any> {
  const { documentId, customerId, action, requestedDate, selectedTimeSlot, locale } = input;
  const customerChanges = action === 'reschedule' ? input.customerChanges ?? {} : {};
  const noteChanges = action === 'reschedule' ? input.noteChanges ?? {} : {};
  const lookup = () => strapi.db.query(PRODUCT).findOne({
    where: { documentId, magentoCustomerId: customerId }, populate: { appointmentGroup: true },
  });
  const initial = await lookup();
  if (!initial) return { error: 'Appointment not found.', status: 404 };
  if (!initial.appointmentGroup || !HOME_TRIAL_FORM_TAGS.includes(initial.formTag)) return undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await strapi.db.transaction(async ({ trx, onCommit }: any) => {
        // Group locks precede product locks, matching submission creation. Lock in ID
        // order so simultaneous moves between a customer's groups cannot invert order.
        const table = strapi.db.metadata.get(GROUP).tableName;
        await strapi.db.connection(table).transacting(trx)
          .where({ magento_customer_id: customerId }).orderBy('id', 'asc').forUpdate();
        const representative = await lookup();
        const groupId = representative?.appointmentGroup?.documentId;
        if (!groupId) return { error: 'Appointment not found.', status: 404 };
        const groups = strapi.documents(GROUP);
        const group = await groups.findOne({ documentId: groupId, populate: { state: true } });
        if (!group || group.magentoCustomerId !== customerId) return { error: 'Appointment not found.', status: 404 };
        const rows = await strapi.db.query(PRODUCT).findMany({
          where: { appointmentGroup: { documentId: groupId } }, orderBy: { id: 'asc' },
        });
        if (!rows.length || rows.some((row: any) => row.magentoCustomerId !== customerId || !HOME_TRIAL_FORM_TAGS.includes(row.formTag))) {
          return { error: 'Appointment not found.', status: 404 };
        }
        await strapi.db.connection(strapi.db.metadata.get(PRODUCT).tableName).transacting(trx)
          .whereIn('id', rows.map((row: any) => row.id)).orderBy('id', 'asc').forUpdate();
        const response = (value: any, changed: boolean, affected: any[] = []) => ({
          data: { documentId, appointmentGroupId: value.documentId,
            appointmentId: value.appointmentReference ?? value.documentId,
            requestedDate: value.requestedDate, selectedTimeSlot: value.selectedTimeSlot,
            workflowStatus: value.workflowStatus,
            ...customerChanges,
            ...noteChanges,
            affectedProductDocumentIds: affected.map((row: any) => row.documentId) }, changed,
        });
        const contactAudit = Object.keys(customerChanges).length > 0;
        const groupCustomerDetails = { ...customerContactDetails(rows[0]), ...customerChanges };
        const previousData = { ...canonical(group),
          ...(Object.keys(noteChanges).length ? { requestDetails: rows[0].requestDetails ?? null,
            productNotes: rows.map((row: any) => ({ documentId: row.documentId, requestDetails: row.requestDetails ?? null })) } : {}),
          ...(contactAudit ? { customerDetails: rows.map((row: any) => customerDetailsSnapshot(row)) } : {}) };
        let target = group;
        let affected = rows;
        let notificationProducts = rows;
        let scheduleChanged = false;
        if (action === 'cancel') {
          affected = rows.filter((row: any) => !inactive(row));
          if (!affected.length && group.workflowStatus === 'Cancelled') return response(group, false);
          if (['Closed', 'Visited'].includes(group.workflowStatus) || rows.some((row: any) => ['Closed', 'Visited'].includes(row.workflowStatus))) {
            return { error: 'Completed or closed appointments cannot be cancelled.', status: 400 };
          }
          target = { ...group, workflowStatus: 'Cancelled' };
          await groups.update({ documentId: groupId, data: { workflowStatus: 'Cancelled', activeScheduleKey: null } });
        } else {
          if (inactive(group) || rows.some(inactive)) return { error: 'Completed, closed or cancelled appointments cannot be rescheduled.', status: 400 };
          const windowError = validateReschedulingWindow(group.requestedDate);
          if (windowError) return { error: windowError, status: 400 };
          scheduleChanged = group.requestedDate !== requestedDate || group.selectedTimeSlot !== selectedTimeSlot;
          if (!scheduleChanged && !customerDetailsChanged(rows, { ...customerChanges, ...noteChanges })) return response(group, false);
          if (scheduleChanged) {
            for (const formTag of new Set(rows.map((row: any) => row.formTag))) {
              const form = await strapi.documents('api::product-form.product-form').findFirst({
                status: 'published', locale, filters: { formTag }, populate: { availableTimeSlots: true },
              });
              const error = form ? validateAppointmentSchedule(requestedDate, selectedTimeSlot, form) : 'The appointment form is unavailable.';
              if (error) return { error, status: 400 };
            }
            const key = homeTrialScheduleKey(customerId, requestedDate, selectedTimeSlot);
            let occupied = await groups.findFirst({ filters: { activeScheduleKey: key }, populate: { state: true } });
            if (occupied) {
              // Also cover a target inserted after the initial customer-group lock query.
              await strapi.db.connection(table).transacting(trx)
                .where({ id: occupied.id }).forUpdate();
              occupied = await groups.findOne({ documentId: occupied.documentId, populate: { state: true } });
              if (!occupied || occupied.activeScheduleKey !== key) {
                throw Object.assign(new Error('Target appointment changed; retry transaction.'), { code: '40001' });
              }
            }
            if (occupied && (occupied.magentoCustomerId !== customerId || inactive(occupied) || occupied.requestedDate !== requestedDate || occupied.selectedTimeSlot !== selectedTimeSlot)) {
              throw new Error('Appointment group does not match its active schedule key.');
            }
            if (occupied && occupied.documentId !== groupId) {
              const targetProducts = await strapi.db.query(PRODUCT).findMany({
                where: { appointmentGroup: { documentId: occupied.documentId } }, orderBy: { id: 'asc' },
              });
              notificationProducts = [...targetProducts, ...rows];
              if (customerDetailsChanged(targetProducts, groupCustomerDetails)) {
                return { error: 'Customer details must match the destination appointment before merging appointments.', status: 400 };
              }
              target = occupied;
              await groups.update({ documentId: groupId, data: { activeScheduleKey: null, mergedInto: target.documentId, workflowStatus: 'Closed' } });
            } else {
              target = { ...group, requestedDate, selectedTimeSlot };
              await groups.update({ documentId: groupId, data: { requestedDate, selectedTimeSlot, activeScheduleKey: key } });
            }
          }
        }
        for (const row of affected) {
          await strapi.documents(PRODUCT).update({ documentId: row.documentId, data:
            action === 'cancel' ? { workflowStatus: 'Cancelled' }
              : { ...canonical(target), appointmentGroup: target.documentId, ...groupCustomerDetails, ...noteChanges },
          });
        }
        await strapi.documents(CHANGE).create({ data: {
          eventType: action === 'cancel' ? 'Cancelled' : 'Rescheduled', changedAt: new Date().toISOString(),
          actorType: 'Customer', magentoCustomerId: customerId,
          sourceGroup: groupId, targetGroup: target.documentId,
          previousData, newData: { ...canonical(target),
            ...noteChanges,
            ...(contactAudit ? { customerDetails: affected.map((row: any) => customerDetailsSnapshot(row, groupCustomerDetails)) } : {}),
            products: affected.map((row: any) => ({ documentId: row.documentId, productId: row.productId ?? null, productName: row.productName ?? null })) },
          affectedSubmissions: { connect: affected.map((row: any) => row.documentId) },
        } });
        if (action === 'cancel' || scheduleChanged) notifyTryAtHomeChangeAfterCommit(strapi, onCommit, action, {
          documentId: target.documentId, manageDocumentId: notificationProducts[0]?.documentId,
          appointmentReference: target.appointmentReference,
          ...groupCustomerDetails, requestedDate: target.requestedDate, selectedTimeSlot: target.selectedTimeSlot,
          addressLine1: target.addressLine1, addressLine2: target.addressLine2, city: target.city,
          state: target.state?.name ?? target.state?.code, pincode: target.pincode,
          productNames: notificationProducts.map((row: any) => row.productName).filter(Boolean),
          sourcePage: notificationProducts[0]?.sourcePage,
        });
        return response(target, true, affected);
      });
    } catch (error) {
      if (attempt === 2 || !retryableGroupRace(error)) throw error;
    }
  }
}
