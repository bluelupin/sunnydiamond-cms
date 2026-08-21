/**
 * product-display-page controller
 */

import { factories } from '@strapi/strapi';

const imageAssetPopulate = {
  populate: {
    desktopImage: true,
    mobileImage: true,
  },
};

const infoCardPopulate = {
  populate: {
    image: true,
    buttons: true,
  },
};

const wildcardPopulate = {
  findYourSize: true,
  stripItems: {
    populate: {
      icon: true,
      image: imageAssetPopulate,
    },
  },
  stripTnc: true,
  hereForYouCard: infoCardPopulate,
  personaliseCard: infoCardPopulate,
  pairItWith: {
    populate: {
      collections: {
        populate: {
          backgroundImage: imageAssetPopulate,
          cta: true,
          productSkus: true,
          localizations: true,
        },
      },
    },
  },
  visitUsSection: {
    populate: {
      image: imageAssetPopulate,
      cta: true,
      showrooms: {
        populate: {
          image: imageAssetPopulate,
          localizations: true,
        },
      },
    },
  },
  localizations: true,
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
