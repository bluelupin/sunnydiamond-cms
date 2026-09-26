/**
 * product-landing-page controller
 */

import { factories } from '@strapi/strapi';
import { fullSeoPopulate, heroPopulate, imageAssetPopulate } from '../../../utils/populate';

const populate = {
  hero: heroPopulate,
  trustBadges: {
    populate: {
      icon: true,
      image: imageAssetPopulate,
    },
  },
  seo: fullSeoPopulate,
  localizations: true,
};

export default factories.createCoreController(
  'api::product-landing-page.product-landing-page' as any,
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }

      return super.find(ctx);
    },
  })
);
