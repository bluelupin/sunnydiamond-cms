/**
 * learn-about-diamonds-page controller
 */

import { factories } from '@strapi/strapi';

const imageAssetPopulate = {
  fields: ['altText'],
  populate: {
    desktopImage: true,
    mobileImage: true,
  },
};

const heroPopulate = {
  populate: {
    image: imageAssetPopulate,
    heroVideo: {
      populate: {
        heroVideo: true,
      },
    },
    primaryCta: true,
    secondaryCta: true,
  },
};

const populate = {
  hero: heroPopulate,
  fourCsIntro: {
    fields: ['heading', 'body'],
    populate: {
      decorativeImage: imageAssetPopulate,
      fourCsTags: {
        fields: ['label', 'sortOrder', 'isActive'],
        populate: {
          icon: true,
        },
      },
    },
  },
  fourCsSection: {
    populate: {
      cVisualPanel: {
        populate: {
          visualImage: {
            populate: {
              desktopImage: true,
              mobileImage: true,
            },
          },
          gradeStops: true,
        },
      },
      cInfoPanel: true,
    },
  },
  certificateSection: {
    populate: {
      certificationLabs: {
        populate: {
          labLogo: imageAssetPopulate,
        },
      },
    },
  },
  learnMoreSection: {
    populate: {
      tabs: {
        populate: {
          carouselImage: {
            populate: {
              image: imageAssetPopulate,
              ctaButton: true,
            },
          },
          featureImage: imageAssetPopulate,
          featureItems: true,
        },
      },
    },
  },
  discoverSection: {
    populate: {
      backgroundImage: imageAssetPopulate,
      steps: true,
    },
  },
  faqSection: {
    populate: {
      faqItems: true,
    },
  },
};

export default factories.createCoreController('api::learn-about-diamonds-page.learn-about-diamonds-page' as any, ({ strapi }) => ({
  async find(ctx) {
    const entity = await strapi.documents('api::learn-about-diamonds-page.learn-about-diamonds-page' as any).findFirst({
      status: 'published',
      populate,
    } as any);

    const sanitizedEntity = entity ? await this.sanitizeOutput(entity, ctx) : null;
    return this.transformResponse(sanitizedEntity);
  },
}));
