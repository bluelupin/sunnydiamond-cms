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

export const fullImageAssetPopulate = {
  populate: {
    desktopImage: true,
    mobileImage: true,
  },
};

export const videoAssetPopulate = {
  fields: ['altText'],
  populate: {
    heroVideo: true,
  },
};

export const ctaPopulate = {
  fields: ['label', 'url', 'targetType', 'openInNewTab'],
};

export const heroPopulate = {
  fields: ['eyebrow', 'title', 'subtitle', 'isActive'],
  populate: {
    bgImage: imageAssetPopulate,
    image: imageAssetPopulate,
    heroVideo: videoAssetPopulate,
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

export const fullSeoPopulate = {
  populate: {
    ogImage: true,
  },
};

export const occasionPopulate = {
  fields: ['title', 'description', 'sortOrder', 'showField'],
  populate: {
    image: imageAssetPopulate,
    cta: ctaPopulate,
  },
};


export const showroomPopulate = {
  fields: ['name', 'slug', 'address', 'city', 'state', 'phone', 'email', 'mapUrl', 'openingHours', 'sortOrder', 'isActive'],
  populate: {
    image: imageAssetPopulate,
  },
};
