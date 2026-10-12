import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::bespoke-submission.bespoke-submission' as any, {
  except: ['create'], // Public writes must pass through submit admission and validation.
});
