import type { Core } from '@strapi/strapi';

const MarkdownIt = require('markdown-it');

const CAREER_OPENING_UID = 'api::career-opening.career-opening';
const HTML_START_PATTERN = /^\s*<[a-z][\w-]*(?:\s|>)/i;
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

type CareerOpening = {
  documentId: string;
  slug?: string | null;
  description?: string | null;
};

const toCkeditorHtml = (value: string) =>
  HTML_START_PATTERN.test(value) ? value : markdown.render(value).trim();

export async function migrateCareerOpeningCkeditor(strapi: Core.Strapi) {
  if (process.env.MIGRATE_CAREER_OPENING_CKEDITOR !== 'true') return;

  const dryRun = process.env.MIGRATE_CAREER_OPENING_CKEDITOR_DRY_RUN !== 'false';
  const localeRows = await strapi.db.query('plugin::i18n.locale').findMany({
    select: ['code'],
  } as any);
  const locales = localeRows.map((locale: { code: string }) => locale.code);
  let converted = 0;
  let skipped = 0;

  for (const locale of locales) {
    const documents = strapi.documents(CAREER_OPENING_UID as any);
    const drafts = (await documents.findMany({
      locale,
      status: 'draft',
      fields: ['slug', 'description'],
      limit: 1000,
    } as any)) as CareerOpening[];
    const published = (await documents.findMany({
      locale,
      status: 'published',
      fields: ['slug', 'description'],
      limit: 1000,
    } as any)) as CareerOpening[];
    const publishedIds = new Set(published.map((opening) => opening.documentId));
    const openings = new Map<string, CareerOpening>();

    for (const opening of published) openings.set(opening.documentId, opening);
    for (const opening of drafts) openings.set(opening.documentId, opening);

    for (const opening of openings.values()) {
      const source = opening.description?.trim();
      if (!source || HTML_START_PATTERN.test(source)) {
        skipped += 1;
        continue;
      }

      const description = toCkeditorHtml(source);
      if (dryRun) {
        strapi.log.info(`[career CKEditor dry-run] ${locale}: ${opening.slug || opening.documentId}`);
        converted += 1;
        continue;
      }

      await documents.update({
        documentId: opening.documentId,
        locale,
        data: { description },
      } as any);

      if (publishedIds.has(opening.documentId)) {
        await documents.publish({
          documentId: opening.documentId,
          locale,
        } as any);
      }

      converted += 1;
      strapi.log.info(`[career CKEditor migrated] ${locale}: ${opening.slug || opening.documentId}`);
    }
  }

  strapi.log.info(
    `Career CKEditor migration ${dryRun ? 'dry-run ' : ''}complete: ${converted} converted, ${skipped} skipped.`
  );
}
