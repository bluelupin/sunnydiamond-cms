/**
 * job-landing-page controller
 */

import { factories } from '@strapi/strapi';
import {
  fullImageAssetPopulate,
  fullSeoPopulate,
} from '../../../utils/populate';

const careerOpeningPopulate = {
  applyCta: true,
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
};

export default factories.createCoreController(
  'api::job-landing-page.job-landing-page',
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }
      return super.find(ctx);
    },
  })
);
