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
    image: imageAssetPopulate,
  },
};

const occasionPopulate = {
  populate: {
    image: imageAssetPopulate,
    hero: heroPopulate,
  },
};

const showroomPopulate = {
  populate: {
    image: imageAssetPopulate,
    seo: seoPopulate,
  },
};

const occasionSectionPopulate = {
  populate: ['image', 'occasions', 'cta'],
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
  populate: ['image', 'showrooms', 'cta'],
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

    return this.transformResponse(sanitizedHomepage);
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

    const [sanitizedHomepage, occasions, showrooms] = await Promise.all([
      this.sanitizeOutput(homepage, ctx),
      strapi.documents('api::occasion.occasion').findMany({
        status: 'published',
        sort: { sortOrder: 'asc' },
        populate: occasionPopulate,
      } as any),
      strapi.documents('api::showroom.showroom').findMany({
        status: 'published',
        sort: { sortOrder: 'asc' },
        populate: showroomPopulate,
      } as any),
    ]);

    const occasionContentType = strapi.contentType('api::occasion.occasion');
    const showroomContentType = strapi.contentType('api::showroom.showroom');
    const [sanitizedOccasions, sanitizedShowrooms] = await Promise.all([
      strapi.contentAPI.sanitize.output(occasions, occasionContentType, {
        auth: ctx.state.auth,
      }),
      strapi.contentAPI.sanitize.output(showrooms, showroomContentType, {
        auth: ctx.state.auth,
      }),
    ]);

    const editorialHomepage = sanitizedHomepage as any;

    if (editorialHomepage?.occasionSection) {
      editorialHomepage.occasionSection.occasions = sanitizedOccasions;
    }

    if (editorialHomepage?.showroomSection) {
      editorialHomepage.showroomSection.showrooms = sanitizedShowrooms;
    }

    return this.transformResponse(editorialHomepage);
  },
}));
