import slugify from '@sindresorhus/slugify';
import type { Core } from '@strapi/strapi';

const UID = 'api::career-opening.career-opening';
const FIELDS = ['jobID', 'title', 'department', 'location'] as const;

export function careerOpeningSlug(opening: Record<string, unknown>) {
  return FIELDS.map((field) =>
    typeof opening[field] === 'string'
      ? slugify(opening[field] as string, { decamelize: false })
      : ''
  ).filter(Boolean).join('-');
}

export function registerCareerOpeningSlug(strapi: Core.Strapi) {
  strapi.documents.use(async (context, next) => {
    if (context.uid !== UID || !['create', 'update'].includes(context.action)) return next();
    const params = context.params as any;
    if (!params.data) return next();

    let current = null;
    if (context.action === 'update' && params.documentId) {
      const query = {
        documentId: params.documentId,
        locale: params.locale,
        fields: [...FIELDS],
      };
      current = await strapi.documents(UID).findOne({ ...query, status: 'draft' })
        ?? await strapi.documents(UID).findOne({ ...query, status: 'published' });
    }
    const opening = { ...current };
    for (const field of FIELDS) {
      if (params.data[field] !== undefined) opening[field] = params.data[field];
    }
    params.data.slug = careerOpeningSlug(opening);
    return next();
  });
}
