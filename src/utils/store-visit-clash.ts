const PRODUCT = 'api::product-submission.product-submission';

export const STORE_VISIT_CLASH_MESSAGE = 'You already have a store visit booked at this showroom for this date and time. ' +
  'To bring another piece, open its product page and add it to that appointment.';

/**
 * Another open store visit by the same signed-in customer at the same showroom, date and slot
 * (R-AP-12). The (customer, date, slot) index range is locked first, so two quick submits
 * cannot both pass. Guests are not matched: an unverified phone number would let anyone
 * block, or probe for, someone else's booking.
 */
export async function storeVisitClash(strapi: any, trx: any, visit: {
  documentId?: string; magentoCustomerId?: number;
  showroom?: string; requestedDate?: string; selectedTimeSlot?: string;
}) {
  const { magentoCustomerId, showroom, requestedDate, selectedTimeSlot } = visit;
  if (!magentoCustomerId || !showroom || !requestedDate || !selectedTimeSlot) return false;
  await strapi.db.connection(strapi.db.metadata.get(PRODUCT).tableName).transacting(trx)
    .where({ magento_customer_id: magentoCustomerId, requested_date: requestedDate, selected_time_slot: selectedTimeSlot })
    .forUpdate();
  const count = await strapi.db.query(PRODUCT).count({ where: {
    formTag: 'product-store-visit', requestedDate, selectedTimeSlot,
    workflowStatus: { $in: ['New', 'Contacted', 'Scheduled'] },
    preferredShowroom: { documentId: showroom },
    magentoCustomerId,
    ...(visit.documentId ? { documentId: { $ne: visit.documentId } } : {}),
  } });
  return count > 0;
}
