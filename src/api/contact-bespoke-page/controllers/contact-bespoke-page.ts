import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::contact-bespoke-page.contact-bespoke-page' as any,
  ({ strapi }) => ({
    async find(ctx) {
      ctx.query = {
        ...ctx.query,
        populate: {
          hero: { populate: '*' },
          visionSection: { populate: '*' },
          featuredStoriesSection: {
            populate: {
              backgroundImage: { populate: '*' },
              cards: { populate: '*' },
              cta: true,
            },
          },
          pastCreations: {
            populate: {
              coverImage: true,
              gallery: true,
              cta: true,
            },
          },
          serviceHighlights: { populate: '*' },
          getInTouchSection: { populate: '*' },
          customDesignForm: true,
          seo: { populate: '*' },
        },
      } as any;

      const response = await super.find(ctx);
      const allFeaturedStories = await strapi
        .documents('api::featured-story.featured-story')
        .findMany({
          status: 'published',
          sort: { createdAt: 'desc' },
          populate: {
            coverImage: true,
            gallery: true,
            cta: true,
          },
        } as any);

      if (response?.data) {
        (response.data as any).pastCreations = allFeaturedStories;
      }

      return response;
    },
  })
);
