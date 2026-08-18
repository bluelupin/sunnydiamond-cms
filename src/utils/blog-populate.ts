import { fullImageAssetPopulate, fullSeoPopulate } from './populate';

export const blogPostMediaPopulate = {
  tags: true,
  heroImage: fullImageAssetPopulate,
  coverImage: fullImageAssetPopulate,
  cutoutImage: fullImageAssetPopulate,
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
  featuredBlogSection: {
    populate: {
      backgroundImage: fullImageAssetPopulate,
    },
  },
  featuredBlog: {
    populate: blogPostPopulate,
  },
  blogCategory: true,
  seo: fullSeoPopulate,
};
