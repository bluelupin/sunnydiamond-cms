import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::contact-bespoke-page.contact-bespoke-page' as any,
  () => ({
    async find(ctx) {
      // `populate=*` only resolves one level. Explicitly populate gallery images so
      // the Past Creations view can render directly from the Bespoke Page response.
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
          pastCreations: { populate: { images: true } },
          serviceHighlights: { populate: '*' },
          getInTouchSection: { populate: '*' },
          customDesignForm: true,
          seo: { populate: '*' },
        },
      } as any;

      return await super.find(ctx);
    },
  })
);
