import type { Core } from '@strapi/strapi';

/** Use the same label-only form in Blog Tags and the create-relation modal. */
export async function configureBlogTagForm(strapi: Core.Strapi) {
  const contentType = strapi.contentTypes['api::blog-tag.blog-tag'];
  const service = strapi.plugin('content-manager').service('content-types');
  const configuration = await service.findConfiguration(contentType);
  const edit = [[{ name: 'label', size: 12 }]];

  if (
    JSON.stringify(configuration.layouts?.edit) === JSON.stringify(edit) &&
    configuration.settings?.mainField === 'label'
  ) return;

  await service.updateConfiguration(contentType, {
    ...configuration,
    settings: { ...configuration.settings, mainField: 'label' },
    layouts: { ...configuration.layouts, edit },
  });
}
