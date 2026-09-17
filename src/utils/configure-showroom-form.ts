import type { Core } from '@strapi/strapi';

/** Use city as the showroom label and repair layouts saved before name was removed. */
export async function configureShowroomForm(strapi: Core.Strapi) {
  const contentType = strapi.contentTypes['api::showroom.showroom'];
  const service = strapi.plugin('content-manager').service('content-types');
  const configuration = await service.findConfiguration(contentType);
  const edit = (configuration.layouts?.edit ?? [])
    .map((row: { name: string; size: number }[]) => row.filter((field) => field.name !== 'name'))
    .filter((row: { name: string }[]) => row.length > 0);
  const visibleFields = new Set(edit.flat().map((field: { name: string }) => field.name));
  for (const [name, attribute] of Object.entries(contentType.attributes)) {
    if (attribute.required && !visibleFields.has(name)) edit.push([{ name, size: 12 }]);
  }
  const list = [...new Set<string>((configuration.layouts?.list ?? [])
    .map((name: string) => name === 'name' ? 'city' : name))];

  if (configuration.settings?.mainField === 'city' &&
    JSON.stringify(configuration.layouts?.edit) === JSON.stringify(edit) &&
    JSON.stringify(configuration.layouts?.list) === JSON.stringify(list)) return;

  await service.updateConfiguration(contentType, {
    ...configuration,
    settings: { ...configuration.settings, mainField: 'city' },
    layouts: { ...configuration.layouts, edit, list },
  });
}
