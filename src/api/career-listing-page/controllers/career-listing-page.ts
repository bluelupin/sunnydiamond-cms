/**
 * career-listing-page controller
 */

import { factories } from '@strapi/strapi';
import { fullImageAssetPopulate } from '../../../utils/populate';

const filterCategoryPopulate = {
  populate: {
    Items: true,
  },
};

const populate = {
  heroSection: {
    populate: {
      backgroundImage: fullImageAssetPopulate,
    },
  },
  filterSection: {
    populate: {
      Location: filterCategoryPopulate,
      Department: filterCategoryPopulate,
      Experience: filterCategoryPopulate,
    },
  },
};

export default factories.createCoreController(
  'api::career-listing-page.career-listing-page',
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }
      return super.find(ctx);
    },
  })
);
