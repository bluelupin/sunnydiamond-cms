/**
 * career-landing-page controller
 */

import { factories } from '@strapi/strapi';
import {
  fullImageAssetPopulate,
  fullSeoPopulate,
} from '../../../utils/populate';

const careerOpeningPopulate = {
  applyCta: true,
  linkedinCta: true,
  seo: fullSeoPopulate,
};

const populate = {
  heroSection: {
    populate: {
      backgroundImage: fullImageAssetPopulate,
    },
  },
  openingsSection: {
    populate: {
      career_openings: {
        populate: careerOpeningPopulate,
      },
    },
  },
  moreThanSection: {
    populate: {
      featuredImage1: fullImageAssetPopulate,
      featuredImage2: fullImageAssetPopulate,
    },
  },
  investingSection: {
    populate: {
      InvestingFeatures: {
        populate: {
          featureImage: fullImageAssetPopulate,
        },
      },
    },
  },
  FAQs: {
    populate: {
      faqItems: true,
    },
  },
  discoverSection: {
    populate: {
      backgroundImage: fullImageAssetPopulate,
      cta: true,
    },
  },
};

export default factories.createCoreController(
  'api::career-landing-page.career-landing-page',
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }
      return super.find(ctx);
    },
  })
);
