import { factories } from '@strapi/strapi';

const imageAssetPopulate = {
  populate: {
    desktopImage: true,
    mobileImage: true,
  },
};

const populate = {
  hero: {
    populate: {
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
  brillianceSection: {
    populate: {
      pinnedImage: imageAssetPopulate,
      featureSlide: {
        populate: {
          image: imageAssetPopulate,
        },
      },
    },
  },
  legacySection: {
    populate: {
      legacyImageBlock: {
        populate: {
          image: imageAssetPopulate,
        },
      },
    },
  },
  teamSection: {
    populate: {
      teamMember: {
        populate: {
          image: imageAssetPopulate,
        },
      },
    },
  },
  craftSection: {
    populate: {
      backgroundImage: imageAssetPopulate,
      videoUrl: {
        populate: {
          heroVideo: true,
        },
      },
    },
  },
  craftMosaicSection: {
    populate: {
      tile: {
        populate: {
          image: imageAssetPopulate,
        },
      },
    },
  },
  timelineSection: {
    populate: {
      backgroundImage: imageAssetPopulate,
      timelineMilestone: true,
    },
  },
  trustBadgesSection: {
    populate: {
      trustBadge: {
        populate: {
          icon: imageAssetPopulate,
        },
      },
    },
  },
  brandTaglineSection: {
    populate: {
      icon: imageAssetPopulate,
    },
  },
  seo: true,
};

export default factories.createCoreController('api::about-page.about-page' as any, ({ strapi }) => ({
  async find(ctx) {
    const entity = await strapi.documents('api::about-page.about-page' as any).findFirst({
      status: 'published',
      populate,
    } as any);

    const sanitizedEntity = entity ? await this.sanitizeOutput(entity, ctx) : null;
    return this.transformResponse(sanitizedEntity);
  },
}));
