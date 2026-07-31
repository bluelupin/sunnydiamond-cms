import type { Core } from '@strapi/strapi';
import blogPosts from '../data/blog-posts.json';

const BLOG_POST_UID = 'api::blog-post.blog-post';
const BLOG_LOCALE = 'en';

export async function seedBlogPosts(strapi: Core.Strapi) {
  strapi.log.info(`Seeding ${blogPosts.length} blog posts from static JSON...`);
 if (process.env.BLOG_SEED_ENABLED !== 'true') {
    strapi.log.info('Blog seeding is disabled. Skipping blog post seeding.');
    return;
  }
  for (const post of blogPosts) {
    try {
      const existing = await strapi.documents(BLOG_POST_UID).findFirst({
        filters: { slug: post.slug },
        locale: BLOG_LOCALE,
      } as any);

      if (existing) {
        await strapi.documents(BLOG_POST_UID).update({
          documentId: existing.documentId,
          data: post,
          locale: BLOG_LOCALE,
          status: 'published',
        } as any);
        strapi.log.info(`Updated blog: ${post.slug}`);
        continue;
      }

      await strapi.documents(BLOG_POST_UID).create({
        data: post,
        locale: BLOG_LOCALE,
        status: 'published',
      } as any);
      strapi.log.info(`Created blog: ${post.slug}`);
    } catch (error) {
      strapi.log.error(`Failed to seed blog ${post.slug}`, error);
    }
  }
}
