import type { Core } from '@strapi/strapi';

// Preserve draft and published CTA values when switching component types.
// Converted links no longer match, so subsequent startups are a no-op.
export async function migrateOccasionCta(strapi: Core.Strapi) {
  const db = strapi.db.connection;
  if (!(await db.schema.hasTable('occasions_cmps'))) return;

  await db.transaction(async (trx) => {
    const links = await trx('occasions_cmps')
      .where({ field: 'cta', component_type: 'shared.cta' });

    for (const link of links) {
      const cta = await trx('components_shared_ctas').where({ id: link.cmp_id }).first();
      if (!cta) throw new Error(`Missing CTA ${link.cmp_id} for occasion ${link.entity_id}`);

      const insert = trx('components_gifting_occasion_ctas').insert({
        label: cta.label,
        url: cta.url,
        target_type: cta.target_type,
        open_in_new_tab: cta.open_in_new_tab,
      });
      const result = ['mysql', 'mysql2'].includes(db.client.config.client)
        ? await insert
        : await insert.returning('id');
      const id = typeof result[0] === 'object' ? result[0].id : result[0];
      if (!id) throw new Error('Failed to copy Occasion CTA');

      await trx('occasions_cmps').where({ id: link.id }).update({
        cmp_id: id,
        component_type: 'gifting.occasion-cta',
      });
    }
  });
}
