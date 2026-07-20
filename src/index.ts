import type { Core } from '@strapi/strapi';
import { seedCms } from './utils/seeder';
import { repairHomepageSections } from './utils/repair-homepage-sections';
import { registerFrontendRevalidation } from './utils/frontend-revalidation';
import { migrateHomepage } from './utils/migrate-homepage';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    registerFrontendRevalidation(strapi);
    if (process.env.CMS_SEED_ENABLED === 'true') {
      await seedCms(strapi);
    }
    if (process.env.MIGRATE_HOMEPAGE && process.env.MIGRATE_HOMEPAGE === 'true') {
      await migrateHomepage(strapi);
    }
  },
};

