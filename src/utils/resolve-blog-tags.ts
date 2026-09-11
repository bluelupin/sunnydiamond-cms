import type { Core } from '@strapi/strapi';
import { normalizeBlogTag } from './blog-tags';

export async function resolveBlogTags(strapi: Core.Strapi, labels: string[]) {
  const result = new Map<string, any>();
  for (const value of labels) {
    const { label, key } = normalizeBlogTag(value);
    if (!label || result.has(key)) continue;
    let tag = await strapi.db.query('api::blog-tag.blog-tag' as any).findOne({
      where: { normalizedLabel: key },
    });
    if (!tag) {
      tag = await strapi.documents('api::blog-tag.blog-tag' as any).create({ data: { label } });
    }
    result.set(key, tag);
  }
  return [...result.values()];
}
