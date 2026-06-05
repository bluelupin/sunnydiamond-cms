export const mediaPopulate = {
  fields: ['name', 'alternativeText', 'caption', 'width', 'height', 'formats', 'hash', 'ext', 'mime', 'size', 'url'],
};

export const imageAssetPopulate = {
  fields: ['altText'],
  populate: {
    desktopImage: true,
    mobileImage: true,
  },
};

export const ctaPopulate = {
  fields: ['label', 'url', 'targetType', 'openInNewTab'],
};

export const heroPopulate = {
  fields: ['eyebrow', 'title', 'subtitle', 'isActive'],
  populate: {
    image: imageAssetPopulate,
    primaryCta: ctaPopulate,
    secondaryCta: ctaPopulate,
  },
};

export const seoPopulate = {
  fields: ['metaTitle', 'metaDescription', 'canonicalUrl'],
  populate: {
    ogImage: mediaPopulate,
  },
};

export const occasionPopulate = {
  fields: ['title', 'slug', 'description', 'sortOrder', 'isActive'],
  populate: {
    image: imageAssetPopulate,
    hero: heroPopulate,
  },
};

export const showroomPopulate = {
  fields: ['name', 'slug', 'address', 'city', 'state', 'phone', 'email', 'mapUrl', 'openingHours', 'sortOrder', 'isActive'],
  populate: {
    image: imageAssetPopulate,
  },
};
