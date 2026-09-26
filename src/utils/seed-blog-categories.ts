import type { Core } from '@strapi/strapi';
import assignments from '../data/blog-category-assignments.json';

const BLOG_POST_UID = 'api::blog-post.blog-post';
const BLOG_CATEGORY_UID = 'api::blog-category.blog-category';
const BLOG_LOCALE = 'en';

export async function seedBlogCategories(strapi: Core.Strapi) {
  const categories = await strapi.documents(BLOG_CATEGORY_UID).findMany({
    locale: BLOG_LOCALE,
    fields: ['title', 'Value'],
  } as any);

  const categoryByName = new Map<string, string>();
  for (const category of categories) {
    if (category.title) categoryByName.set(category.title.trim().toLowerCase(), category.documentId);
    if (category.Value) categoryByName.set(category.Value.trim().toLowerCase(), category.documentId);
  }

  let updated = 0;
  let skipped = 0;

  for (const assignment of assignments) {
    const categoryDocumentId = categoryByName.get(assignment.category.toLowerCase());
    if (!categoryDocumentId) {
      skipped += 1;
      strapi.log.warn(`Blog category not found: ${assignment.category}`);
      continue;
    }

    const post = await strapi.documents(BLOG_POST_UID).findFirst({
      filters: { slug: assignment.slug },
      locale: BLOG_LOCALE,
      status: 'published',
    } as any);

    if (!post) {
      skipped += 1;
      strapi.log.warn(`Published blog post not found: ${assignment.slug}`);
      continue;
    }

    await strapi.documents(BLOG_POST_UID).update({
      documentId: post.documentId,
      locale: BLOG_LOCALE,
      status: 'published',
      data: {
        blog_category: {
          connect: [categoryDocumentId],
        },
      },
    } as any);
    updated += 1;
  }

  strapi.log.info(`Blog category assignment complete: ${updated} updated, ${skipped} skipped.`);
}
