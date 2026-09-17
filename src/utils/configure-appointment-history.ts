import type { Core } from '@strapi/strapi';

/** Content Manager configuration only; never rewrites appointment records. */
export async function configureAppointmentHistory(strapi: Core.Strapi) {
  const service = strapi.plugin('content-manager').service('content-types');
  for (const [uid, mainField, readonlyFields] of [
    ['api::appointment-group.appointment-group', 'documentId', ['submissions', 'mergedInto']],
    ['api::appointment-change.appointment-change', 'eventType', ['sourceGroup', 'targetGroup', 'affectedSubmissions']],
  ] as const) {
    const model = strapi.contentTypes[uid];
    const configuration = await service.findConfiguration(model);
    const metadatas = { ...configuration.metadatas };
    let edit = (configuration.layouts?.edit ?? []).map((row: any[]) => [...row]);
    const visible = new Set(edit.flat().map((field: any) => field.name));
    for (const name of readonlyFields) {
      metadatas[name] = { ...metadatas[name], edit: {
        ...metadatas[name]?.edit, editable: false, visible: true,
      } };
      if (!visible.has(name)) edit.push([{ name, size: 12 }]);
    }
    const settings = { ...configuration.settings, mainField,
      ...(uid.includes('appointment-change') ? { defaultSortBy: 'changedAt', defaultSortOrder: 'DESC' } : {}),
    };
    let list = configuration.layouts?.list;
    if (uid === 'api::appointment-change.appointment-change') {
      const labels: Record<string, string> = {
        eventType: 'Action', changedAt: 'Changed on', actorType: 'Changed by',
        previousData: 'Previous appointment', newData: 'Updated appointment',
        affectedSubmissions: 'Affected products',
      };
      for (const [name, label] of Object.entries(labels)) {
        metadatas[name] = { ...metadatas[name],
          edit: { ...metadatas[name]?.edit, label, visible: true, editable: false,
            ...(name === 'affectedSubmissions' ? { mainField: 'productName' } : {}) },
          list: { ...metadatas[name]?.list, label },
        };
      }
      for (const name of ['legacyMigrationKey', 'magentoCustomerId', 'sourceGroup', 'targetGroup']) {
        metadatas[name] = { ...metadatas[name], edit: { ...metadatas[name]?.edit, visible: false, editable: false } };
      }
      edit = [
        [{ name: 'eventType', size: 6 }, { name: 'changedAt', size: 6 }],
        [{ name: 'actorType', size: 12 }],
        [{ name: 'previousData', size: 12 }], [{ name: 'newData', size: 12 }],
        [{ name: 'affectedSubmissions', size: 12 }],
      ];
      list = ['changedAt', 'eventType', 'affectedSubmissions', 'actorType'];
    }
    const updated = { ...configuration, settings, metadatas, layouts: { ...configuration.layouts, edit, ...(list ? { list } : {}) } };
    if (JSON.stringify(updated) !== JSON.stringify(configuration)) await service.updateConfiguration(model, updated);
  }
}
