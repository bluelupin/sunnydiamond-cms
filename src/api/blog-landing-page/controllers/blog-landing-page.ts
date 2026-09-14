/**
 * blog-page controller
 */

import { factories } from '@strapi/strapi';
import { blogLandingPopulate } from '../../../utils/blog-populate';

const UID = 'api::blog-landing-page.blog-landing-page';

export default factories.createCoreController(UID as any, ({ strapi }) => ({
  async find(ctx) {
    if (ctx.query.populate === '*') {
      ctx.query = {
        ...ctx.query,
        populate: blogLandingPopulate,
      } as any;
    }

    const response = await super.find(ctx);
    if (!response.data) return response;

    const query = await this.sanitizeQuery(ctx);
    const posts = await strapi.documents('api::blog-post.blog-post').findMany({
      locale: query.locale,
      status: 'published',
      fields: ['documentId'],
      filters: { blog_category: { documentId: { $notNull: true } } },
      populate: { blog_category: { fields: ['documentId'] } },
    } as any) as any[];
    const categoryCounts = new Map<string, number>();
    for (const post of posts) {
      const categoryId = post.blog_category?.documentId;
      if (categoryId) {
        categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
      }
    }
    const categoryIds = [...categoryCounts.keys()];
    const categories = categoryIds.length
      ? await strapi.documents('api::blog-category.blog-category').findMany({
          locale: query.locale,
          status: 'published',
          filters: { documentId: { $in: categoryIds } },
          fields: ['title', 'Value'],
          sort: ['title:asc', 'documentId:asc'],
        } as any)
      : [];
    const sanitizedCategories = await strapi.contentAPI.sanitize.output(
      categories,
      strapi.contentType('api::blog-category.blog-category'),
      { auth: ctx.state.auth }
    ) as Array<{ documentId: string; [key: string]: unknown }>;
    const blogCategory = sanitizedCategories.map((category) => ({
      ...category,
      count: categoryCounts.get(category.documentId) ?? 0,
    }));

    return {
      ...response,
      data: { ...response.data, blogCategory },
    };
  },
}));
