import { factories } from '@strapi/strapi';
import { ctaPopulate, fullSeoPopulate } from '../../../utils/populate';

const populate = {
  contactSection: {
    populate: {
      contactOptions: { populate: { cta: ctaPopulate } },
    },
  },
  faqSection: {
    populate: {
      faqItems: true,
    },
  },
  seo: fullSeoPopulate,
  localizations: true,
};

export default factories.createCoreController(
  'api::support-page.support-page' as any,
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }

      return super.find(ctx);
    },
  })
);
