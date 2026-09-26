/**
 * profile-page controller
 */

import { factories } from '@strapi/strapi';
import { ctaPopulate, imageAssetPopulate } from '../../../utils/populate';

const populate = {
  backgroundImage: imageAssetPopulate,
  sideTabs: true,
  trustBadgeSection: {
    populate: {
      callsToAction: ctaPopulate,
    },
  },
};

export default factories.createCoreController(
  'api::profile-page.profile-page',
  () => ({
    async find(ctx) {
      ctx.query = {
        ...ctx.query,
        populate,
      } as any;

      return super.find(ctx);
    },
  })
);
