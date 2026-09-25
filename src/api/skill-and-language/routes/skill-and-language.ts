import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::skill-and-language.skill-and-language' as any, {
  config: {
    find: { auth: false },
  },
});
