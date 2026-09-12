import type { Core } from '@strapi/strapi';

/** Remove tag columns from the saved list layout, retaining the edit form. */
export async function configureBlogPostList(strapi: Core.Strapi) {
  const contentType = strapi.contentTypes['api::blog-post.blog-post'];
  const service = strapi.plugin('content-manager').service('content-types');
  const configuration = await service.findConfiguration(contentType);
  const list: string[] | undefined = configuration.layouts?.list;

  if (!list?.some((field) => field === 'blogTags' || field === 'tags')) return;

  await service.updateConfiguration(contentType, {
    ...configuration,
    layouts: {
      ...configuration.layouts,
      list: list.filter((field) => field !== 'blogTags' && field !== 'tags'),
    },
  });
}
