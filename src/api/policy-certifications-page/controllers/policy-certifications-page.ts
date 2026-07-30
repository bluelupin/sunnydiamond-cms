/**
 * policy-certifications-page controller
 */

import { factories } from '@strapi/strapi';
import { fullSeoPopulate } from '../../../utils/populate';

const populate = {
  headerSection: true,
  policyCategories: {
    populate: {
      policies: {
        populate: {
          accordionItems: true,
        },
      },
    },
  },
  contactSection: {
    populate: {
      contactOptions: true,
    },
  },
  seo: fullSeoPopulate,
};

export default factories.createCoreController(
  'api::policy-certifications-page.policy-certifications-page' as any,
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }
      return super.find(ctx);
    },
  })
);
