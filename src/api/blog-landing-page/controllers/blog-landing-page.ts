/**
 * blog-page controller
 */

import { factories } from '@strapi/strapi';

const UID = 'api::blog-landing-page.blog-landing-page';

export default factories.createCoreController(UID as any, () => ({
  async find(ctx) {
    if (ctx.query.populate === '*') {
      ctx.query = {
        ...ctx.query,
        populate: {
          heroSection: {
            populate: {
              backgroundImage: true,
            },
          },
          blog_categories: true,
          seo: {
            populate: {
              ogImage: true,
            },
          },
        },
      } as any;
    }

    return super.find(ctx);
  },
}));
