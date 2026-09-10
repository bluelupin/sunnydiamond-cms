import { factories } from '@strapi/strapi';
import {
  ctaPopulate,
  fullSeoPopulate,
  heroPopulate,
  imageAssetPopulate,
  showroomPopulate,
} from '../../../utils/populate';

const populate = {
  heroSection: heroPopulate,
  cta: ctaPopulate,
  contactSection: {
    populate: {
      contactOptions: true,
    },
  },
  formSection: {
    populate: {
      form: {
        populate: {
          availableTimeSlots: true,
          dynamicFields: {
            populate: {
              dropdownOptions: true,
            },
          },
          showrooms: showroomPopulate,
        },
      },
    },
  },
  visitSection: {
    populate: {
      image: imageAssetPopulate,
      showrooms: showroomPopulate,
      cta: ctaPopulate,
    },
  },
  seo: fullSeoPopulate,
  localizations: true,
};

export default factories.createCoreController(
  'api::contact-page.contact-page' as any,
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }

      return super.find(ctx);
    },
  })
);
