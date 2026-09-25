import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::skill-and-language.skill-and-language' as any, () => ({
  async find(ctx) {
    const { search, ...query } = ctx.query;

    if (search !== undefined && typeof search !== 'string') {
      return ctx.badRequest('search must be a string');
    }

    const term = typeof search === 'string' ? search.trim() : '';
    ctx.query = {
      ...query,
      ...(term
        ? {
            filters: {
              $and: [
                ...(query.filters ? [query.filters] : []),
                { label: { $containsi: term } },
              ],
            },
          }
        : {}),
    };

    return super.find(ctx);
  },
}));
