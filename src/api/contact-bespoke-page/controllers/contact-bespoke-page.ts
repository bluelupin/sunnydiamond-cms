import { factories } from '@strapi/strapi';
import { requestLocale } from '../../../utils/request-locale';

export default factories.createCoreController(
  'api::contact-bespoke-page.contact-bespoke-page' as any,
  ({ strapi }) => ({
    async find(ctx) {
      const locale = requestLocale(ctx);
      ctx.query = {
        ...ctx.query,
        populate: {
          hero: { populate: {
            backgroundImage:{
              populate: {
                desktopImage:true,
                mobileImage:true
              },
            }
          } },
          visionSection: {
            fields: ['title', 'description', 'showField'],
            populate: {
              cards: {
                populate: {
                  image: {
                    populate: {
                      desktopImage: true,
                      mobileImage: true,
                    },
                  },
                  video: {
                    populate: {
                      heroVideo: true,
                    },
                  },
                },
              },
              cta: true,
            },
          },
          featuredStoriesSection: {
            populate: {
              backgroundImage: { 
                populate: {
                desktopImage:true,
                mobileImage:true
              } 
            },
            cards:{
              populate:{
                coverImage:{
                  populate:
                    '*'
                },
                gallery: {
                  populate: '*'
                }
              }
            },
              cta: true,
              secondaryCta: true,
            },
          },
          pastCreations: {
            populate: {
                coverImage:{
                  populate:'*'
                },
              gallery: { populate: '*' },
              cta: true,
            },
          },
          serviceHighlights: { populate: '*' },
          getInTouchSection: { 
            populate:{
              backgroundImage: { populate: {
                desktopImage:true,
                mobileImage:true
              } },
              cta:true

            }
          },
          customDesignForm: true,
          seo: { populate: '*' },
        },
      } as any;

      const response = await super.find(ctx);
      const allFeaturedStories = await strapi
        .documents('api::featured-story.featured-story')
        .findMany({
          status: 'published',
          locale,
          sort: { createdAt: 'desc' },
          populate: {
            coverImage: { populate: '*' },
            gallery: { populate: '*' },
            cta: { populate: '*' },
          },
        } as any);

      if (response?.data) {
        (response.data as any).pastCreations = allFeaturedStories;
      }

      return response;
    },
  })
);
