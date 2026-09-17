import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::product-submission.product-submission' as any, {
  // Customer writes must use the authenticated submission/rescheduling flow.
  except: ['create', 'update', 'delete'],
});
