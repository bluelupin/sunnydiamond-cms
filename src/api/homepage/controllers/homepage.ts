import { factories } from '@strapi/strapi';
import {
  ctaPopulate,
  imageAssetPopulate,
  mediaPopulate,
  occasionPopulate,
  seoPopulate,
  showroomPopulate,
  videoAssetPopulate,
} from '../../../utils/populate';
import { requestLocale } from '../../../utils/request-locale';

const HOMEPAGE_UID = 'api::homepage.homepage';
const GLOBAL_CONFIG_UID = 'api::global-config.global-config';

const categoryCardPopulate = {
  fields: ['title', 'sortOrder','showField'],
  populate: {
    image: imageAssetPopulate,
    hoverImage: imageAssetPopulate,
    cutoutImage: imageAssetPopulate,
    cta: ctaPopulate,
  },
};

const craftingBrillianceSectionPopulate = {
  populate: {
    backgroundImage: imageAssetPopulate,
    cutoutImage: imageAssetPopulate,
    cta: ctaPopulate,
  },
};

const diamondSourcingSectionPopulate = {
  populate: {
    gifOrImage: imageAssetPopulate,
    cutoutImage: imageAssetPopulate,
    backgroundImage: imageAssetPopulate,
  },
};

const featuredProductsSectionPopulate = {
  populate: {
    cta: ctaPopulate,
  },
};

const giftingBannerPopulate = {
  populate: {
    backgroundImage: imageAssetPopulate,
    backgroundVideo: videoAssetPopulate,
    cutoutImage: imageAssetPopulate,
    primaryCta: ctaPopulate,
    secondaryCta: ctaPopulate,
  },
};

const sunnyPromisePopulate = {
  populate: {
    video: videoAssetPopulate,
    image:imageAssetPopulate,
    cta: ctaPopulate,
  },
};

const bespokeForYouPopulate = {
  populate: {
    backgroundImage: imageAssetPopulate,
    primaryCta: ctaPopulate,
    secondaryCta: ctaPopulate,
  },
};

const diamondsForEveryonePopulate = {
  populate: {
    backgroundImage: imageAssetPopulate,
    cta: ctaPopulate,
    steps:true
  },
};

const processStepPopulate = {
  fields: ['title', 'description', 'sortOrder', 'isActive'],
  populate: {
    icon: mediaPopulate,
    image: imageAssetPopulate,
  },
};

const occasionSectionPopulate = {
  fields: ['sectionTitle'],
  populate: {
    occasions: occasionPopulate,
  },
};

const processSectionPopulate = {
  fields: ['sectionTitle', 'description', 'sortOrder', 'showField'],
  populate: {
    image: imageAssetPopulate,
    steps: processStepPopulate,
    cta: ctaPopulate,
    backgroundImage: imageAssetPopulate,
  },
};

const showroomSectionPopulate = {
  fields: ['sectionTitle', 'description', 'sortOrder', 'showField'],
  populate: {
    image: imageAssetPopulate,
    showrooms: showroomPopulate,
    cta: ctaPopulate,
  },
};

const occasionRelationFallbackPopulate = {
  image: {
    populate: {
      desktopImage: true,
      mobileImage: true,
    },
  },
  cta: true,
};


const showroomRelationFallbackPopulate = {
  image: {
    populate: {
      desktopImage: true,
      mobileImage: true,
    },
  },
};

const collectionShowcaseSectionPopulate = {
  fields: ['eyebrow', 'title'],
  populate: {
    collections: {
      fields: [
        'collectionName',
        'title',
        'slug',
        'description',
        'featuredProductSku',
        'sortOrder',
        'isActive',
      ],
      populate: {
        backgroundImage: imageAssetPopulate,
        cta: ctaPopulate,
        productSkus: {
          fields: ['sku'],
        },
      },
    },
  },
};

const globalHeaderPopulate = {
  headerNavigationLinks: {
    fields: ['label', 'url', 'targetType', 'sortOrder', 'isActive'],
  },
  footerLinkGroups: {
    fields: ['title', 'sortOrder', 'isActive'],
    populate: {
      links: {
        fields: ['label', 'url', 'targetType', 'sortOrder', 'isActive'],
      },
    },
  },
  footerTickerItems: {
    fields: ['label', 'sortOrder', 'isActive'],
  },
  socialLinks: {
    fields: ['label', 'url', 'targetType', 'sortOrder', 'isActive'],
  },
  paymentMethodLogos: mediaPopulate,
  defaultSeo: seoPopulate,
};

const homepageShellPopulate = {
  hero: {
    populate: {
      videoBackground: videoAssetPopulate,
      imageBackground: imageAssetPopulate,
      ctaButton: ctaPopulate,
    },
  },
  seo: seoPopulate,
};

const homepageSectionsPopulate = {
  trustBadges: {
    fields: ['label', 'sortOrder', 'showField'],
    populate: {
      icon: mediaPopulate,
    },
  },
  craftingBrillianceSection: craftingBrillianceSectionPopulate,
  categoryCards: categoryCardPopulate,
  diamondSourcingSection: diamondSourcingSectionPopulate,
  featuredCollection: collectionShowcaseSectionPopulate,
  occasionSection: occasionSectionPopulate,
  featuredProducts: featuredProductsSectionPopulate,
  giftingBanner: giftingBannerPopulate,
  sunnyPromise: sunnyPromisePopulate,
  bespokeForYou: bespokeForYouPopulate,
  diamondsForEveryone: diamondsForEveryonePopulate,
  craftsmanshipSection: processSectionPopulate,
  showroom: showroomSectionPopulate,
};

const homepageShoppingBlocksPopulate = {
  trustBadges: homepageSectionsPopulate.trustBadges,
  categoryCards: homepageSectionsPopulate.categoryCards,
  featuredCollection: homepageSectionsPopulate.featuredCollection,
  featuredProducts: homepageSectionsPopulate.featuredProducts,
  giftingBanner: homepageSectionsPopulate.giftingBanner,
};

const homepageEditorialBlocksPopulate = {
  craftingBrillianceSection: homepageSectionsPopulate.craftingBrillianceSection,
  diamondSourcingSection: homepageSectionsPopulate.diamondSourcingSection,
  occasionSection: homepageSectionsPopulate.occasionSection,
  sunnyPromise: homepageSectionsPopulate.sunnyPromise,
  bespokeForYou: homepageSectionsPopulate.bespokeForYou,
  diamondsForEveryone: homepageSectionsPopulate.diamondsForEveryone,
  craftsmanshipSection: homepageSectionsPopulate.craftsmanshipSection,
  showroom: homepageSectionsPopulate.showroom,
};

const findPublishedSingle = async (
  strapiInstance: typeof strapi,
  uid: string,
  populate: Record<string, unknown>,
  locale?: string
) => {
  return strapiInstance.documents(uid as any).findFirst({
    status: 'published',
    locale,
    sort: { updatedAt: 'desc' },
    populate,
  } as any);
};

const attachOccasionsAndShowrooms = async (
  strapiInstance: typeof strapi,
  homepage: any,
  ctx: any,
  locale?: string
) => {
  if (!homepage) return homepage;

  const needsOccasions = Boolean(homepage.occasionSection);
  const needsShowrooms = Boolean(homepage.showroom);

  if (!needsOccasions && !needsShowrooms) return homepage;

  const [occasions, showrooms] = await Promise.all([
    needsOccasions
      ? strapiInstance.documents('api::occasion.occasion').findMany({
          status: 'published',
          locale,
          filters: { showField: true },
          sort: ['sortOrder:asc'],
          populate: occasionRelationFallbackPopulate,
        } as any)
      : Promise.resolve([]),
    needsShowrooms
      ? strapiInstance.documents('api::showroom.showroom').findMany({
          status: 'published',
          locale,
          filters: { isActive: true },
          sort: ['sortOrder:asc'],
          populate: showroomRelationFallbackPopulate,
        } as any)
      : Promise.resolve([]),
  ]);

  const [sanitizedOccasions, sanitizedShowrooms] = await Promise.all([
    needsOccasions
      ? strapiInstance.contentAPI.sanitize.output(
          occasions,
          strapiInstance.contentType('api::occasion.occasion'),
          { auth: ctx.state.auth }
        )
      : Promise.resolve([]),
    needsShowrooms
      ? strapiInstance.contentAPI.sanitize.output(
          showrooms,
          strapiInstance.contentType('api::showroom.showroom'),
          { auth: ctx.state.auth }
        )
      : Promise.resolve([]),
  ]);

  if (needsOccasions) {
    homepage.occasionSection.occasions = sanitizedOccasions ?? [];
  }
  if (needsShowrooms) {
    homepage.showroom.showrooms = sanitizedShowrooms ?? [];
  }

  return homepage;
};

export default factories.createCoreController(HOMEPAGE_UID as any, ({ strapi }) => ({
  async shell(ctx) {
    const locale = requestLocale(ctx);
    const [globalConfig, homepage] = await Promise.all([
      findPublishedSingle(strapi, GLOBAL_CONFIG_UID, globalHeaderPopulate, locale),
      findPublishedSingle(strapi, HOMEPAGE_UID, homepageShellPopulate, locale),
    ]);

    const globalContentType = strapi.contentType(GLOBAL_CONFIG_UID);
    const homepageContentType = strapi.contentType(HOMEPAGE_UID);
    const sanitizedGlobal = globalConfig
      ? await strapi.contentAPI.sanitize.output(globalConfig, globalContentType, {
          auth: ctx.state.auth,
        })
      : null;
    const sanitizedHomepage = homepage
      ? await strapi.contentAPI.sanitize.output(homepage, homepageContentType, {
          auth: ctx.state.auth,
        })
      : null;

    return {
      data: {
        global: sanitizedGlobal,
        homepage: sanitizedHomepage,
      },
      meta: {},
    };
  },

  async sections(ctx) {
    const locale = requestLocale(ctx);
    const homepage = await findPublishedSingle(
      strapi,
      HOMEPAGE_UID,
      homepageSectionsPopulate,
      locale
    );
    if (!homepage) {
      return this.transformResponse(null);
    }

    const sanitizedHomepage = await this.sanitizeOutput(homepage, ctx);
    const enrichedHomepage = await attachOccasionsAndShowrooms(
      strapi,
      sanitizedHomepage,
      ctx,
      locale
    );

    return this.transformResponse(enrichedHomepage);
  },

  async shoppingBlocks(ctx) {
    const homepage = await findPublishedSingle(
      strapi,
      HOMEPAGE_UID,
      homepageShoppingBlocksPopulate,
      requestLocale(ctx)
    );
    if (!homepage) {
      return this.transformResponse(null);
    }

    return this.transformResponse(homepage);
  },

  async editorialBlocks(ctx) {
    const locale = requestLocale(ctx);
    const homepage = await findPublishedSingle(
      strapi,
      HOMEPAGE_UID,
      homepageEditorialBlocksPopulate,
      locale
    );
    if (!homepage) {
      return this.transformResponse(null);
    }

    const sanitizedHomepage = await this.sanitizeOutput(homepage, ctx);
    const enrichedHomepage = await attachOccasionsAndShowrooms(
      strapi,
      sanitizedHomepage,
      ctx,
      locale
    );

    return this.transformResponse(enrichedHomepage);
  },
}));
