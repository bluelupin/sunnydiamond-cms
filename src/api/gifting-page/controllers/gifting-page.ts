import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::gifting-page.gifting-page' as any,
  () => ({
    async find(ctx) {
      ctx.query = {
        ...ctx.query,
        populate: {
          heroSection: { populate: { backgroundImage: { populate: '*' } } },
          introSection: { populate: { backgroundImage: { populate: '*' } } },
          occasionGridSection: { populate: { cards: { populate: { image: { populate: '*' }, cta: true } } } },
          perfectGiftSection: { populate: { products: { populate: { image: { populate: '*' }, cta: true } } } },
          giftFinderSection: { populate: { image: { populate: '*' }, fields: { populate: { options: true } } } },
          giftCardSection: { populate: { backgroundImage: { populate: '*' }, productImage: { populate: '*' }, cta: true } },
          finishingTouchSection: { populate: { services: { populate: { image: { populate: '*' }, cta: true } } } },
          trustBadgesSection: { populate: { trustBadge: { populate: { icon: { populate: '*' } } } } },
          seo: { populate: '*' },
        },
      } as any;
      return super.find(ctx);
    },
  })
);
