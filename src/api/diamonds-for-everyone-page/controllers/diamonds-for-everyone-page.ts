import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::diamonds-for-everyone-page.diamonds-for-everyone-page' as any,
  () => ({
    async find(ctx) {
      ctx.query = {
        ...ctx.query,
        populate: {
          heroSection: {
            populate: {
              backgroundImage: { populate: '*' },
            },
          },
          planIntroSection: {
            populate: {
              backgroundImage: { populate: '*' },
            },
          },
          investmentPlannerSection: {
            populate: {
              image: { populate: '*' },
              backgroundImage: { populate: '*' },
              cta: true,
            },
          },
          editorialBannerSection: {
            populate: {
              image: { populate: '*' },
              cta: true,
            },
          },
          benefitsSection: {
            populate: {
              steps: true,
              cta: true,
              backgroundImage: { populate: '*' },
            },
          },
          faqSection: {
            populate: {
              faqItems: true,
            },
          },
          seo: { populate: '*' },
        },
      } as any;

      return super.find(ctx);
    },
  })
);
