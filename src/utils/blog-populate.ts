import { fullImageAssetPopulate, fullSeoPopulate } from './populate';

export const blogPostMediaPopulate = {
  tags: true,
  heroImage: fullImageAssetPopulate,
  coverImage: fullImageAssetPopulate,
  seo: fullSeoPopulate,
};

export const blogPostPopulate = {
  ...blogPostMediaPopulate,
  blog_category: true,
};

export const blogLandingPopulate = {
  heroSection: {
    populate: {
      backgroundImage: fullImageAssetPopulate,
    },
  },
  blog_categories: {
    populate: {
      blog_posts: {
        populate: blogPostMediaPopulate,
      },
    },
  },
  seo: fullSeoPopulate,
};
