import { factories } from '@strapi/strapi';
import { ctaPopulate, imageAssetPopulate } from '../../../utils/populate';

const populate = {
  brandIdentity: true,
  headerNavigationLinks: {
    populate: {
      cards: {
        populate: {
          image: imageAssetPopulate,
          cta: ctaPopulate,
        },
      },
    },
  },
  sidebarNavigation: true,
  footerLinkGroups: true,
  footerTickerItems: true,
  socialLinks: true,
  paymentMethodLogos: true,
  defaultSeo: true,
  localizations: true,
};

export default factories.createCoreController('api::global-config.global-config' as any, () => ({
  async find(ctx) {
    if (ctx.query.populate === '*') {
      ctx.query = { ...ctx.query, populate } as any;
    }

    return super.find(ctx);
  },
}));
