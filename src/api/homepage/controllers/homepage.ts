import { factories } from '@strapi/strapi';

const HOMEPAGE_UID = 'api::homepage.homepage';
const GLOBAL_CONFIG_UID = 'api::global-config.global-config';

const mediaPopulate = {
  fields: ['name', 'alternativeText', 'caption', 'width', 'height', 'formats', 'hash', 'ext', 'mime', 'size', 'url'],
};

const ctaPopulate = {
  fields: ['label', 'url', 'targetType', 'openInNewTab'],
};

const imageAssetPopulate = {
  fields: ['altText'],
  populate: {
    desktopImage: mediaPopulate,
    mobileImage: mediaPopulate,
  },
};

const heroPopulate = {
  fields: ['eyebrow', 'title', 'subtitle', 'isActive'],
  populate: {
    image: imageAssetPopulate,
    primaryCta: ctaPopulate,
    secondaryCta: ctaPopulate,
  },
};

const seoPopulate = {
  fields: ['metaTitle', 'metaDescription', 'canonicalUrl'],
  populate: {
    ogImage: mediaPopulate,
  },
};

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
    cta: ctaPopulate,
  },
};

const editorialSectionPopulate = {
  fields: ['sectionTitle', 'description', 'isActive'],
  populate: {
    image: imageAssetPopulate,
    cta: ctaPopulate,
  },
};

const processStepPopulate = {
  fields: ['title', 'description', 'sortOrder', 'isActive'],
  populate: {
    icon: mediaPopulate,
  },
};

const globalHeaderPopulate = {
  headerNavigationLinks: {
    fields: ['label', 'url', 'targetType', 'sortOrder', 'isActive'],
  },
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
  featuredCollectionSection: editorialSectionPopulate,
  giftingBanner: heroPopulate,
  featuredProductsSection: editorialSectionPopulate,
  occasionsTeaser: editorialSectionPopulate,
  craftsmanshipSteps: processStepPopulate,
  sunnyPromiseSection: editorialSectionPopulate,
  bespokeForYouCards: promoCardPopulate,
  showroomTeaser: editorialSectionPopulate,
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
  occasionsTeaser: homepageSectionsPopulate.occasionsTeaser,
  craftsmanshipSteps: homepageSectionsPopulate.craftsmanshipSteps,
  sunnyPromiseSection: homepageSectionsPopulate.sunnyPromiseSection,
  bespokeForYouCards: homepageSectionsPopulate.bespokeForYouCards,
  showroomTeaser: homepageSectionsPopulate.showroomTeaser,
};

const findPublishedSingle = async (
  strapiInstance: typeof strapi,
  uid: string,
  populate: Record<string, unknown>
) => {
  return strapiInstance.documents(uid as any).findFirst({
    status: 'published',
    populate,
  } as any);
};

export default factories.createCoreController(HOMEPAGE_UID as any, ({ strapi }) => ({
  async shell(ctx) {
    const [globalConfig, homepage] = await Promise.all([
      findPublishedSingle(strapi, GLOBAL_CONFIG_UID, globalHeaderPopulate),
      findPublishedSingle(strapi, HOMEPAGE_UID, homepageShellPopulate),
    ]);

    const globalContentType = strapi.contentType(GLOBAL_CONFIG_UID);
    const homepageContentType = strapi.contentType(HOMEPAGE_UID);
    const sanitizedGlobal = await strapi.contentAPI.sanitize.output(globalConfig, globalContentType, {
      auth: ctx.state.auth,
    });
    const sanitizedHomepage = await strapi.contentAPI.sanitize.output(homepage, homepageContentType, {
      auth: ctx.state.auth,
    });

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
    const sanitizedHomepage = await this.sanitizeOutput(homepage, ctx);

    return this.transformResponse(sanitizedHomepage);
  },

  async shoppingBlocks(ctx) {
    const homepage = await findPublishedSingle(strapi, HOMEPAGE_UID, homepageShoppingBlocksPopulate);
    const sanitizedHomepage = await this.sanitizeOutput(homepage, ctx);

    return this.transformResponse(sanitizedHomepage);
  },

  async editorialBlocks(ctx) {
    const homepage = await findPublishedSingle(strapi, HOMEPAGE_UID, homepageEditorialBlocksPopulate);
    const sanitizedHomepage = await this.sanitizeOutput(homepage, ctx);

    return this.transformResponse(sanitizedHomepage);
  },
}));
