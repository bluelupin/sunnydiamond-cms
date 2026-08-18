import type { Core } from '@strapi/strapi';

const HERO_COMPONENT_UIDS = [
  'gifting.hero-section',
  'diamonds-for-everyone.hero-section',
  'shared.listing-hero-section',
  'shared.homepage-hero',
  'shared.hero-section',
  'shared.career-hero-section',
  'shared.blog-page-hero',
  'shared.bespoke-hero',
] as const;

type LayoutField = {
  name: string;
  size: number;
};

const packLayoutRows = (fields: LayoutField[]) => {
  const rows: LayoutField[][] = [];
  let row: LayoutField[] = [];
  let rowSize = 0;

  for (const field of fields) {
    if (row.length > 0 && rowSize + field.size > 12) {
      rows.push(row);
      row = [];
      rowSize = 0;
    }

    row.push(field);
    rowSize += field.size;
  }

  if (row.length > 0) rows.push(row);
  return rows;
};

export async function syncHeroComponentLayouts(strapi: Core.Strapi) {
  const componentService = strapi.plugin('content-manager').service('components') as any;

  for (const uid of HERO_COMPONENT_UIDS) {
    const component = componentService.findComponent(uid);
    if (!component) continue;

    const configuration = await componentService.findConfiguration(component);
    const currentFields = configuration.layouts.edit.flat() as LayoutField[];
    const fieldsByName = new Map(currentFields.map((field) => [field.name, field]));
    const orderedFields = Object.keys(component.attributes)
      .map((name) => fieldsByName.get(name))
      .filter((field): field is LayoutField => Boolean(field));
    const editLayout = packLayoutRows(orderedFields);

    if (JSON.stringify(configuration.layouts.edit) === JSON.stringify(editLayout)) continue;

    await componentService.updateConfiguration(component, {
      settings: configuration.settings,
      metadatas: configuration.metadatas,
      layouts: {
        ...configuration.layouts,
        edit: editLayout,
      },
      options: configuration.options,
    });

    strapi.log.info(`Synchronized Content Manager layout for ${uid}`);
  }
}
