/**
 * product-display-page controller
 */

import { factories } from '@strapi/strapi';

const wildcardPopulate = {
  findYourSize: true,
  stripItems: {
    populate: {
      icon: true,
    },
  },
  stripTnc: true,
  hereForYouCard: true,
  personaliseCard: {
    populate: {
      image: true,
    },
  },
  pairItWith: true,
  visitUsSection: true,
};

export default factories.createCoreController(
  'api::product-display-page.product-display-page' as any,
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate: wildcardPopulate } as any;
      }

      return super.find(ctx);
    },
  })
);
