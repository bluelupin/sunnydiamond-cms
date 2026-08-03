import type { Core } from '@strapi/strapi';
import { seedCms } from './utils/seeder';
// import { repairHomepageSections } from './utils/repair-homepage-sections';
import { registerFrontendRevalidation } from './utils/frontend-revalidation';
import { migrateHomepage } from './utils/migrate-homepage';
import { migrateGradeStopImages } from './utils/migrate-grade-stop-images';
import { seedBlogPosts } from './utils/blog-seeder';
import { seedBlogCategories } from './utils/seed-blog-categories';
import { migrateCareerOpeningCkeditor } from './utils/migrate-career-opening-ckeditor';
// import { cleanStaleAdminPermissions } from './utils/clean-stale-admin-permissions';

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
    // await cleanStaleAdminPermissions(strapi);
    registerFrontendRevalidation(strapi);
    if (process.env.CMS_SEED_ENABLED === 'true') {
      await seedCms(strapi);
    }
    if (process.env.MIGRATE_HOMEPAGE && process.env.MIGRATE_HOMEPAGE === 'true') {
      await migrateHomepage(strapi);
    }
    if (process.env.MIGRATE_GRADE_STOP_IMAGES === 'true') {
      await migrateGradeStopImages(strapi);
    }
    if (process.env.BLOG_SEED_ENABLED === 'true') {
      await seedBlogPosts(strapi);
    }
    if (process.env.BLOG_CATEGORY_SEED_ENABLED === 'true') {
      await seedBlogCategories(strapi);
    }
    if (process.env.MIGRATE_CAREER_OPENING_CKEDITOR === 'true') {
      await migrateCareerOpeningCkeditor(strapi);
    }
  },
};
