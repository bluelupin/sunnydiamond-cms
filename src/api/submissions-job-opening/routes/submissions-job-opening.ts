/**
 * submissions-job-opening router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter(
  'api::submissions-job-opening.submissions-job-opening',
  { except: ['create'] }
);
