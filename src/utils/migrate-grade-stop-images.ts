import type { Core } from '@strapi/strapi';

const GRADE_STOP_TABLE = 'components_shared_grade_stop_nodes';
const GRADE_STOP_LINK_TABLE = `${GRADE_STOP_TABLE}_cmps`;
const OLD_IMAGE_TABLE = 'components_shared_image_assets';
const NEW_IMAGE_TABLE = 'components_shared_grade_stop_image_assets';
const MEDIA_LINK_TABLE = 'files_related_mph';

const OLD_COMPONENT = 'shared.image-asset';
const NEW_COMPONENT = 'shared.grade-stop-image-asset';

function insertedId(result: unknown): number {
  const first = Array.isArray(result) ? result[0] : result;
  const value =
    first && typeof first === 'object' && 'id' in first
      ? (first as { id: unknown }).id
      : first;
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Could not resolve inserted grade-stop image ID: ${JSON.stringify(result)}`);
  }

  return id;
}

export async function migrateGradeStopImages(strapi: Core.Strapi) {
  const db = strapi.db.connection;
  const dryRun = process.env.MIGRATE_GRADE_STOP_IMAGES_DRY_RUN === 'true';
  const requiredTables = [
    GRADE_STOP_TABLE,
    GRADE_STOP_LINK_TABLE,
    OLD_IMAGE_TABLE,
    NEW_IMAGE_TABLE,
    MEDIA_LINK_TABLE,
  ];

  for (const table of requiredTables) {
    if (!(await db.schema.hasTable(table))) {
      throw new Error(`Grade-stop image migration aborted: DB table "${table}" does not exist.`);
    }
  }

  const oldLinks = await db(GRADE_STOP_LINK_TABLE)
    .where({
      field: 'gradeImage',
      component_type: OLD_COMPONENT,
    })
    .orderBy('entity_id', 'asc');

  const newLinks = await db(GRADE_STOP_LINK_TABLE)
    .where({ component_type: NEW_COMPONENT })
    .whereIn('field', ['gradeImage', 'gradeStopImage'])
    .orderBy('entity_id', 'asc');

  const currentFieldIds = new Set(
    newLinks
      .filter((link: any) => link.field === 'gradeImage')
      .map((link: any) => Number(link.entity_id))
  );
  const migratedGradeStopIds = new Set(
    newLinks.map((link: any) => Number(link.entity_id))
  );
  const pendingByGradeStop = new Map<number, any>();

  for (const link of oldLinks) {
    const gradeStopId = Number(link.entity_id);
    if (!migratedGradeStopIds.has(gradeStopId) && !pendingByGradeStop.has(gradeStopId)) {
      pendingByGradeStop.set(gradeStopId, link);
    }
  }

  const pendingLinks = [...pendingByGradeStop.values()];
  const legacyNewLinks = newLinks.filter(
    (link: any) =>
      link.field === 'gradeStopImage' &&
      !currentFieldIds.has(Number(link.entity_id))
  );
  const oldLinksToDetach = oldLinks.filter(
    (link: any) => migratedGradeStopIds.has(Number(link.entity_id))
  );

  if (
    pendingLinks.length === 0 &&
    legacyNewLinks.length === 0 &&
    oldLinksToDetach.length === 0
  ) {
    strapi.log.info('Grade-stop image migration: nothing to migrate.');
    return;
  }

  if (dryRun) {
    strapi.log.info(
      `[DRY RUN] Grade-stop image migration: ${pendingLinks.length} copy, ${legacyNewLinks.length} rename, ${oldLinksToDetach.length} old link(s) detach.`
    );
    return;
  }

  let migrated = 0;
  let renamed = 0;
  let skipped = 0;

  await db.transaction(async (trx) => {
    for (const link of legacyNewLinks) {
      await trx(GRADE_STOP_LINK_TABLE)
        .where({
          entity_id: link.entity_id,
          cmp_id: link.cmp_id,
          component_type: NEW_COMPONENT,
          field: 'gradeStopImage',
        })
        .update({ field: 'gradeImage' });
      renamed += 1;
    }

    for (const link of oldLinksToDetach) {
      await trx(GRADE_STOP_LINK_TABLE)
        .where({
          entity_id: link.entity_id,
          cmp_id: link.cmp_id,
          component_type: OLD_COMPONENT,
          field: 'gradeImage',
        })
        .delete();
    }

    for (const link of pendingLinks) {
      const oldImage = await trx(OLD_IMAGE_TABLE).where({ id: link.cmp_id }).first();

      if (!oldImage) {
        skipped += 1;
        strapi.log.warn(
          `Grade-stop image migration: missing ${OLD_COMPONENT} ID ${link.cmp_id}; grade stop ${link.entity_id} skipped.`
        );
        continue;
      }

      const insertResult = await trx(NEW_IMAGE_TABLE)
        .insert({
          alt_text: oldImage.alt_text ?? null,
          caption: oldImage.caption ?? null,
        })
        .returning('id');
      const newImageId = insertedId(insertResult);

      const orderResult = await trx(GRADE_STOP_LINK_TABLE)
        .where({ entity_id: link.entity_id })
        .max({ maxOrder: 'order' })
        .first();
      const nextOrder = Number(orderResult?.maxOrder ?? -1) + 1;

      await trx(GRADE_STOP_LINK_TABLE).insert({
        entity_id: link.entity_id,
        cmp_id: newImageId,
        component_type: NEW_COMPONENT,
        field: 'gradeImage',
        order: nextOrder,
      });

      const mediaLinks = await trx(MEDIA_LINK_TABLE)
        .where({
          related_id: link.cmp_id,
          related_type: OLD_COMPONENT,
        })
        .whereIn('field', ['desktopImage', 'mobileImage']);

      for (const mediaLink of mediaLinks) {
        await trx(MEDIA_LINK_TABLE).insert({
          file_id: mediaLink.file_id,
          related_id: newImageId,
          related_type: NEW_COMPONENT,
          field: mediaLink.field,
          order: mediaLink.order ?? 1,
        });
      }

      await trx(GRADE_STOP_LINK_TABLE)
        .where({
          entity_id: link.entity_id,
          cmp_id: link.cmp_id,
          component_type: OLD_COMPONENT,
          field: 'gradeImage',
        })
        .delete();

      migrated += 1;
    }
  });

  strapi.log.info(
    `Grade-stop image migration complete: ${migrated} copied, ${renamed} renamed, ${skipped} skipped. API field remains gradeImage.`
  );
}
