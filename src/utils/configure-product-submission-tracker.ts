import type { Core } from '@strapi/strapi';

export async function configureProductSubmissionTracker(strapi: Core.Strapi) {
  const model = strapi.contentTypes['api::product-submission.product-submission'];
  const service = strapi.plugin('content-manager').service('content-types');
  const configuration = await service.findConfiguration(model);
  const edit = (configuration.layouts?.edit ?? [])
    .map((row: { name: string; size: number }[]) => row.filter((field) => field.name !== 'rescheduleHistory'))
    .filter((row: { name: string }[]) => row.length > 0);
  edit.push([{ name: 'rescheduleHistory', size: 12 }]);
  const metadata = configuration.metadatas?.rescheduleHistory ?? {};
  const metadatas = {
    ...configuration.metadatas,
    rescheduleHistory: {
      ...metadata,
      edit: { ...metadata.edit, label: 'Reschedule tracker', editable: false, visible: true },
    },
  };
  if (JSON.stringify(configuration.layouts?.edit) === JSON.stringify(edit) &&
    JSON.stringify(configuration.metadatas) === JSON.stringify(metadatas)) return;
  await service.updateConfiguration(model, {
    ...configuration, metadatas,
    layouts: { ...configuration.layouts, edit },
  });
}
