/**
 * learn-about-diamonds-page controller
 */

import { factories } from '@strapi/strapi';

const populate = {
  hero: true,
  fourCsIntro: true,
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
      certificationLabs: true,
    },
  },
  learnMoreSection: {
    populate: {
      tabs: true,
    },
  },
  ctaBanner: true,
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
