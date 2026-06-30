import { factories } from '@strapi/strapi';
import {
  ctaPopulate,
  heroPopulate,
  imageAssetPopulate,
  mediaPopulate,
  occasionPopulate,
  seoPopulate,
  showroomPopulate,
  videoAssetPopulate,
} from '../../../utils/populate';

const HOMEPAGE_UID = 'api::homepage.homepage';
const GLOBAL_CONFIG_UID = 'api::global-config.global-config';

const categoryCardPopulate = {
  fields: ['title', 'sortOrder', 'isActive'],
  populate: {
    image: imageAssetPopulate,
    hoverImage: imageAssetPopulate,
    cutoutImage: imageAssetPopulate,
    cta: ctaPopulate,
  },
};

const promoCardPopulate = {
  fields: ['title', 'description', 'sortOrder', 'isActive'],
  populate: {
    image: imageAssetPopulate,
    video: videoAssetPopulate,
    cta: ctaPopulate,
  },
};

const editorialSectionPopulate = {
  fields: ['sectionTitle', 'description', 'isActive'],
  populate: {
    bgImage: imageAssetPopulate,
    cutoutImage: imageAssetPopulate,
    video: videoAssetPopulate,
    cta: ctaPopulate,
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
  fields: ['sectionTitle', 'description', 'sortOrder', 'isActive'],
  populate: {
    image: imageAssetPopulate,
    occasions: occasionPopulate,
    cta: ctaPopulate,
  },
};

const processSectionPopulate = {
  fields: ['sectionTitle', 'description', 'sortOrder', 'isActive'],
  populate: {
    image: imageAssetPopulate,
    steps: processStepPopulate,
    cta: ctaPopulate,
  },
};

const showroomSectionPopulate = {
  fields: ['sectionTitle', 'description', 'sortOrder', 'isActive'],
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
  hero: {
    populate: {
      image: {
        populate: {
          desktopImage: true,
          mobileImage: true,
        },
      },
      primaryCta: true,
      secondaryCta: true,
    },
  },
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
  fields: ['sectionTitle', 'description', 'magentoCollectionRef', 'sortOrder', 'isActive'],
  populate: {
    primaryImage: imageAssetPopulate,
    secondaryImage: imageAssetPopulate,
    collection: {
      fields: ['title', 'slug', 'description', 'sortOrder', 'isActive'],
      populate: {
        featuredImage: imageAssetPopulate,
        productSection: editorialSectionPopulate,
        seo: seoPopulate,
      },
    },
    cta: ctaPopulate,
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
  hero: heroPopulate,
  seo: seoPopulate,
};

const homepageSectionsPopulate = {
  trustBadges: {
    fields: ['label', 'sortOrder', 'isActive'],
    populate: {
      icon: mediaPopulate,
    },
  },
  categoryNavigation: categoryCardPopulate,
  diamondSourcingSection: editorialSectionPopulate,
  featuredCollectionSection: collectionShowcaseSectionPopulate,
  giftingBanner: heroPopulate,
  featuredProductsSection: editorialSectionPopulate,
  occasionSection: occasionSectionPopulate,
  craftsmanshipSection: processSectionPopulate,
  sunnyPromiseSection: editorialSectionPopulate,
  bespokeForYouCards: promoCardPopulate,
  showroomSection: showroomSectionPopulate,
};

const homepageShoppingBlocksPopulate = {
  trustBadges: homepageSectionsPopulate.trustBadges,
  categoryNavigation: homepageSectionsPopulate.categoryNavigation,
  featuredCollectionSection: homepageSectionsPopulate.featuredCollectionSection,
  featuredProductsSection: homepageSectionsPopulate.featuredProductsSection,
  giftingBanner: homepageSectionsPopulate.giftingBanner,
};

const homepageEditorialBlocksPopulate = {
  diamondSourcingSection: homepageSectionsPopulate.diamondSourcingSection,
  occasionSection: homepageSectionsPopulate.occasionSection,
  craftsmanshipSection: homepageSectionsPopulate.craftsmanshipSection,
  sunnyPromiseSection: homepageSectionsPopulate.sunnyPromiseSection,
  bespokeForYouCards: homepageSectionsPopulate.bespokeForYouCards,
  showroomSection: homepageSectionsPopulate.showroomSection,
};

const findPublishedSingle = async (
  strapiInstance: typeof strapi,
  uid: string,
  populate: Record<string, unknown>
) => {
  return strapiInstance.documents(uid as any).findFirst({
    status: 'published',
    sort: { updatedAt: 'desc' },
    populate,
  } as any);
};

// Strapi 5 does not fully hydrate collection relations nested inside fixed
// components on this homepage single type. Keep this as one bounded query per
// relation-backed section, not per item.
const attachOccasionsAndShowrooms = async (
  strapiInstance: typeof strapi,
  homepage: any,
  ctx: any
) => {
  if (!homepage) return homepage;

  const needsOccasions = Boolean(homepage.occasionSection);
  const needsShowrooms = Boolean(homepage.showroomSection);

  if (!needsOccasions && !needsShowrooms) return homepage;

  const [occasions, showrooms] = await Promise.all([
    needsOccasions
      ? strapiInstance.db.query('api::occasion.occasion').findMany({
          where: {
            isActive: true,
            publishedAt: { $notNull: true },
          },
          orderBy: { sortOrder: 'asc' },
          populate: occasionRelationFallbackPopulate,
        } as any)
      : Promise.resolve([]),
    needsShowrooms
      ? strapiInstance.db.query('api::showroom.showroom').findMany({
          where: {
            isActive: true,
            publishedAt: { $notNull: true },
          },
          orderBy: { sortOrder: 'asc' },
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
    homepage.showroomSection.showrooms = sanitizedShowrooms ?? [];
  }

  return homepage;
};

export default factories.createCoreController(HOMEPAGE_UID as any, ({ strapi }) => ({
  async shell(ctx) {
    const [globalConfig, homepage] = await Promise.all([
      findPublishedSingle(strapi, GLOBAL_CONFIG_UID, globalHeaderPopulate),
      findPublishedSingle(strapi, HOMEPAGE_UID, homepageShellPopulate),
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
    const homepage = await findPublishedSingle(strapi, HOMEPAGE_UID, homepageSectionsPopulate);
    if (!homepage) {
      return this.transformResponse(null);
    }

    const sanitizedHomepage = await this.sanitizeOutput(homepage, ctx);
    const enrichedHomepage = await attachOccasionsAndShowrooms(strapi, sanitizedHomepage, ctx);

    return this.transformResponse(enrichedHomepage);
  },

  async shoppingBlocks(ctx) {
    const homepage = await findPublishedSingle(strapi, HOMEPAGE_UID, homepageShoppingBlocksPopulate);
    if (!homepage) {
      return this.transformResponse(null);
    }

    const sanitizedHomepage = await this.sanitizeOutput(homepage, ctx);

    return this.transformResponse(sanitizedHomepage);
  },

  async editorialBlocks(ctx) {
    const homepage = await findPublishedSingle(strapi, HOMEPAGE_UID, homepageEditorialBlocksPopulate);
    if (!homepage) {
      return this.transformResponse(null);
    }

    const sanitizedHomepage = await this.sanitizeOutput(homepage, ctx);
    const enrichedHomepage = await attachOccasionsAndShowrooms(strapi, sanitizedHomepage, ctx);

    return this.transformResponse(enrichedHomepage);
  },
}));
