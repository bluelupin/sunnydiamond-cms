/**
 * blog-page controller
 */

import { factories } from '@strapi/strapi';
import { blogLandingPopulate } from '../../../utils/blog-populate';

const UID = 'api::blog-landing-page.blog-landing-page';

export default factories.createCoreController(UID as any, () => ({
  async find(ctx) {
    if (ctx.query.populate === '*') {
      ctx.query = {
        ...ctx.query,
        populate: blogLandingPopulate,
      } as any;
    }

    return super.find(ctx);
  },
}));
