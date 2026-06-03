import type { Core } from '@strapi/strapi';
import { seedCms } from './utils/seeder';
import { repairHomepageSections } from './utils/repair-homepage-sections';

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
    // await seedCms(strapi);
    if (process.env.REPAIR_HOMEPAGE_SECTIONS && process.env.REPAIR_HOMEPAGE_SECTIONS === 'true') {
      await repairHomepageSections(strapi);
    }
  },
};
