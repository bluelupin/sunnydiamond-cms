import { factories } from '@strapi/strapi';
import { fullSeoPopulate } from '../../../utils/populate';

const populate = {
  applyCta: true,
  seo: fullSeoPopulate,
};

export default factories.createCoreController(
  'api::career-opening.career-opening' as any,
  () => ({
    async find(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }
      return super.find(ctx);
    },

    async findOne(ctx) {
      if (ctx.query.populate === '*') {
        ctx.query = { ...ctx.query, populate } as any;
      }
      return super.findOne(ctx);
    },
  })
);
