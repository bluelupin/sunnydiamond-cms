import type { Core } from '@strapi/strapi';

// Copy only Help & Support's component tree, preserving draft and published rows.
// Converted links no longer match, making subsequent startups a no-op.
export async function migrateSupportContactSection(strapi: Core.Strapi) {
  const db = strapi.db.connection;
  const metadata = (uid: string) => strapi.db.metadata.get(uid as any);
  const pageLinks = (metadata('api::support-page.support-page').attributes.contactSection as any).joinTable.name;
  if (!(await db.schema.hasTable(pageLinks))) return;

  await db.transaction(async (trx) => {
    async function copyComponent(oldUid: string, newUid: string, oldId: number) {
      const oldMeta = metadata(oldUid);
      const newMeta = metadata(newUid);
      const row = await trx(oldMeta.tableName).where({ id: oldId }).first();
      if (!row) throw new Error(`Missing ${oldUid} component ${oldId}`);
      const { id: _id, ...values } = row;
      const insert = trx(newMeta.tableName).insert(values);
      const result = ['mysql', 'mysql2'].includes(db.client.config.client)
        ? await insert
        : await insert.returning('id');
      const newId = typeof result[0] === 'object' ? result[0].id : result[0];
      if (!newId) throw new Error(`Failed to copy ${oldUid}`);

      const field = oldUid === 'shared.contact-support-section' ? 'contactOptions' : 'cta';
      const oldLinks = (oldMeta.attributes[field] as any).joinTable.name;
      const newLinks = (newMeta.attributes[field] as any).joinTable.name;
      const links = await trx(oldLinks).where({ entity_id: oldId, field });
      for (const link of links) {
        const { id: _linkId, ...copy } = link;
        copy.entity_id = newId;
        if (field === 'contactOptions') {
          copy.cmp_id = await copyComponent('shared.contact-option', 'support.contact-option', link.cmp_id);
          copy.component_type = 'support.contact-option';
        } else {
          // Clone CTA rows too, so edits remain independent of the old tree.
          const ctaTable = metadata('shared.cta').tableName;
          const cta = await trx(ctaTable).where({ id: link.cmp_id }).first();
          if (!cta) throw new Error(`Missing CTA ${link.cmp_id}`);
          const { id: _ctaId, ...ctaValues } = cta;
          const ctaInsert = trx(ctaTable).insert(ctaValues);
          const ctaResult = ['mysql', 'mysql2'].includes(db.client.config.client)
            ? await ctaInsert
            : await ctaInsert.returning('id');
          copy.cmp_id = typeof ctaResult[0] === 'object' ? ctaResult[0].id : ctaResult[0];
          if (!copy.cmp_id) throw new Error('Failed to copy support CTA');
        }
        await trx(newLinks).insert(copy);
      }
      return newId;
    }

    const links = await trx(pageLinks).where({
      field: 'contactSection', component_type: 'shared.contact-support-section',
    });
    for (const link of links) {
      const id = await copyComponent('shared.contact-support-section', 'support.contact-section', link.cmp_id);
      await trx(pageLinks).where({ id: link.id }).update({
        cmp_id: id, component_type: 'support.contact-section',
      });
    }
  });
}
