/**
 * learn-about-diamonds-page controller
 */

import { factories } from '@strapi/strapi';
import { requestLocale } from '../../../utils/request-locale';

const imageAssetPopulate = {
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
    backgroundVideo: {
      populate: {
        heroVideo: true,
      },
    },
    primaryCta: true,
    secondaryCta: true,
  },
};

const populate = {
  seo: {
    fields: [
      'metaTitle',
      'metaDescription',
      'canonicalUrl',
      'metaKeywords',
      'structuredData',
      'showField',
    ],
    populate: {
      ogImage: true,
    },
  },
  hero: heroPopulate,
  fourCsIntro: {
    fields: ['heading', 'body', 'isActive'],
    populate: {
      decorativeImage: imageAssetPopulate,
      fourCsTags: {
        fields: ['label', 'showField'],
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
          gradeStops: {
            fields:['gradeCode', 'gradeLongLabel'],
            populate:{
              gradeImage:{
                populate:{
                desktopImage: true,
                mobileImage: true,
                }
              }
            }
          },
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
          featureGroups: {
            populate: {
              featureItems: {
                populate: {
                  icon: imageAssetPopulate,
                },
              },
            },
          },
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
      locale: requestLocale(ctx),
      populate,
    } as any);

    const sanitizedEntity = entity ? await this.sanitizeOutput(entity, ctx) : null;
    return this.transformResponse(sanitizedEntity);
  },
}));
