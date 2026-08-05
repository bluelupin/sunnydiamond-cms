import type { Core } from '@strapi/strapi';
import careerOpenings from '../data/career-openings.json';

const CAREER_OPENING_UID = 'api::career-opening.career-opening';

export async function seedCareerOpenings(strapi: Core.Strapi) {
  if (process.env.CAREER_OPENING_SEED_ENABLED !== 'true') {
    strapi.log.info('Career opening seeding is disabled. Skipping.');
    return;
  }

  for (const opening of careerOpenings) {
    const locale = opening.locale || 'en';
    const documents = strapi.documents(CAREER_OPENING_UID as any);
    const existing = await documents.findFirst({
      filters: { slug: opening.slug },
      locale,
      status: 'draft',
    } as any);
    const data = { ...opening } as any;
    delete data.locale;

    try {
      const document = existing
        ? await documents.update({
            documentId: existing.documentId,
            locale,
            data,
          } as any)
        : await documents.create({ locale, data } as any);

      await documents.publish({ documentId: document.documentId, locale } as any);
      strapi.log.info(`${existing ? 'Updated' : 'Created'} career opening: ${opening.slug}`);
    } catch (error) {
      strapi.log.error(`Failed to seed career opening ${opening.slug}`, error);
    }
  }
}
