import { factories } from '@strapi/strapi';
import { requestLocale } from '../../../utils/request-locale';

const imageAssetPopulate = {
  populate: {
    desktopImage: true,
    mobileImage: true,
  },
};

export default factories.createCoreController(
  'api::store-locator-page.store-locator-page' as any,
  ({ strapi }) => ({
    async find(ctx) {
      const entity = await strapi
        .documents('api::store-locator-page.store-locator-page' as any)
        .findFirst({
          status: 'published',
          locale: requestLocale(ctx),
          populate: {
            hero: {
              populate: {
                bgImage: imageAssetPopulate,
                image: imageAssetPopulate,
                heroVideo: {
                  populate: {
                    heroVideo: true,
                  },
                },
                primaryCta: true,
                secondaryCta: true,
              },
            },
            locationFilters: {
              populate: {
                icon: imageAssetPopulate,
              },
            },
            showrooms: {
              populate: {
                image: imageAssetPopulate,
              },
            },
            seo: true,
          },
        } as any);

      const sanitizedEntity = entity
        ? await this.sanitizeOutput(entity, ctx)
        : null;

      return this.transformResponse(sanitizedEntity);
    },
  })
);
