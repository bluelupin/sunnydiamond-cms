import { normalizeAppointmentPhone } from './normalize-appointment-phone';

const PRODUCT = 'api::product-submission.product-submission';
const STORE_VISIT_TAGS = ['store-visit', 'product-store-visit'];
const BATCH_SIZE = 250;

/** Only call with identity asserted by the authenticated website server. */
export async function linkGuestStoreVisits(strapi: any, customer: { id: number; email?: string; phone?: string }) {
  const phone = normalizeAppointmentPhone(customer.phone);
  const email = customer.email?.trim().toLowerCase();
  if (!phone && !email) return;

  const table = strapi.db.metadata.get(PRODUCT).tableName;
  let lastId = 0;
  // Normalize in JavaScript so matching behaves identically on every supported database.
  // Read bounded batches; keep original booking contact details intact.
  while (true) {
    const rows = await strapi.db.connection(table)
      .select('id', 'customer_phone', 'customer_email')
      .whereIn('form_tag', STORE_VISIT_TAGS)
      .whereNull('magento_customer_id')
      .where('id', '>', lastId)
      .orderBy('id', 'asc')
      .limit(BATCH_SIZE);
    if (rows.length === 0) return;

    for (const row of rows) {
      const bookingPhone = normalizeAppointmentPhone(row.customer_phone);
      const matches = bookingPhone
        ? Boolean(phone && bookingPhone === phone)
        : Boolean(email && typeof row.customer_email === 'string' && row.customer_email.trim().toLowerCase() === email);
      if (!matches) continue;

      // Recheck ownership and contact values at write time: another request cannot
      // replace an owner or claim a booking whose contact details changed after reading.
      await strapi.db.connection(table)
        .where({ id: row.id, customer_phone: row.customer_phone, customer_email: row.customer_email })
        .whereIn('form_tag', STORE_VISIT_TAGS)
        .whereNull('magento_customer_id')
        .update({ magento_customer_id: customer.id });
    }
    lastId = rows[rows.length - 1].id;
    if (rows.length < BATCH_SIZE) return;
  }
}
