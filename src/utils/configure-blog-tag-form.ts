import type { Core } from '@strapi/strapi';

/** Keep Blog Tag forms label-only and hide the normalized label in the list. */
export async function configureBlogTagForm(strapi: Core.Strapi) {
  const contentType = strapi.contentTypes['api::blog-tag.blog-tag'];
  const service = strapi.plugin('content-manager').service('content-types');
  const configuration = await service.findConfiguration(contentType);
  const edit = [[{ name: 'label', size: 12 }]];
  const list: string[] | undefined = configuration.layouts?.list;
  const hasNormalizedLabel = list?.includes('normalizedLabel');

  if (
    JSON.stringify(configuration.layouts?.edit) === JSON.stringify(edit) &&
    configuration.settings?.mainField === 'label' &&
    !hasNormalizedLabel
  ) return;

  await service.updateConfiguration(contentType, {
    ...configuration,
    settings: { ...configuration.settings, mainField: 'label' },
    layouts: {
      ...configuration.layouts,
      edit,
      ...(hasNormalizedLabel && {
        list: list.filter((field) => field !== 'normalizedLabel'),
      }),
    },
  });
}
