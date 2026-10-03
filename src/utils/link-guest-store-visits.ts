const PRODUCT = 'api::product-submission.product-submission';

/** Only call with identity asserted by the authenticated website server. */
export async function linkGuestStoreVisits(strapi: any, customer: { id: number; email?: string }) {
  if (!customer.email) return;

  // One conditional UPDATE prevents concurrent requests from replacing an owner.
  // Normalize historical emails too; do not change booking contact information.
  await strapi.db.connection(strapi.db.metadata.get(PRODUCT).tableName)
    .whereIn('form_tag', ['store-visit', 'product-store-visit'])
    .whereNull('magento_customer_id')
    .whereRaw('LOWER(TRIM(??)) = ?', ['customer_email', customer.email.trim().toLowerCase()])
    .update({ magento_customer_id: customer.id });
}
