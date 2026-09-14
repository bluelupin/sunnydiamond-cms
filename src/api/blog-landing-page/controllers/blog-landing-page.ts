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
    const categoryIds = [...new Set(
      posts.map((post) => post.blog_category?.documentId).filter(Boolean)
    )];
    const categories = categoryIds.length
      ? await strapi.documents('api::blog-category.blog-category').findMany({
          locale: query.locale,
          status: 'published',
          filters: { documentId: { $in: categoryIds } },
          fields: ['title', 'Value'],
          sort: ['title:asc', 'documentId:asc'],
        } as any)
      : [];
    const blogCategory = await strapi.contentAPI.sanitize.output(
      categories,
      strapi.contentType('api::blog-category.blog-category'),
      { auth: ctx.state.auth }
    );

    return {
      ...response,
      data: { ...response.data, blogCategory },
    };
  },
}));
