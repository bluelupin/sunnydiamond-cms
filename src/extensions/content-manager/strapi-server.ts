import { careerOpeningSlug } from '../../utils/career-opening-slug';

export default (plugin: any) => {
  const createUidService = plugin.services.uid;

  plugin.services.uid = (context: any) => {
    const service = createUidService(context);
    const generateUIDField = service.generateUIDField;

    service.generateUIDField = async function (params: any) {
      if (params.contentTypeUID === 'api::career-opening.career-opening' && params.field === 'slug') {
        // The Regenerate request contains current form values, including unsaved edits.
        // Match the save handler exactly; the unique job ID identifies the opening.
        return careerOpeningSlug(params.data ?? {});
      }
      return generateUIDField.call(this, params);
    };

    return service;
  };

  return plugin;
};
