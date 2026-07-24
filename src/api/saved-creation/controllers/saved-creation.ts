import crypto from 'crypto';
import { factories } from '@strapi/strapi';

const SAVED_CREATION_UID = 'api::saved-creation.saved-creation';
const FEATURED_STORY_UID = 'api::featured-story.featured-story';

const requestData = (ctx: any) => {
  const body = ctx.request.body ?? {};
  return body.data && typeof body.data === 'object' ? body.data : body;
};

const documentIdOrUndefined = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 64 ? trimmed : undefined;
};

const saveKey = (magentoCustomerId: number, creationDocumentId: string) =>
  crypto
    .createHash('sha256')
    .update(`${magentoCustomerId}:${creationDocumentId}`)
    .digest('hex');

const creationPopulate = {
  creation: {
    populate: {
      coverImage: true,
      gallery: true,
      cta: true,
    },
  },
};

const publicSavedCreation = (savedCreation: any) => ({
  documentId: savedCreation.documentId,
  savedAt: savedCreation.createdAt,
  creation: savedCreation.creation,
});

export default factories.createCoreController(SAVED_CREATION_UID as any, ({ strapi }) => ({
  async createForCustomer(ctx) {
    const creationDocumentId = documentIdOrUndefined(requestData(ctx).creationDocumentId);
    if (!creationDocumentId) {
      return ctx.badRequest('creationDocumentId is required.');
    }

    const creation = await strapi.documents(FEATURED_STORY_UID as any).findOne({
      documentId: creationDocumentId,
      status: 'published',
      fields: ['documentId'],
    } as any);
    if (!creation) {
      return ctx.notFound('Creation not found.');
    }

    const magentoCustomerId = ctx.state.magentoCustomer.id;
    const key = saveKey(magentoCustomerId, creationDocumentId);
    const existing = await strapi.documents(SAVED_CREATION_UID as any).findFirst({
      filters: { saveKey: key },
      populate: creationPopulate,
    } as any);

    if (existing) {
      return {
        data: publicSavedCreation(existing),
        meta: { alreadySaved: true },
      };
    }

    try {
      const savedCreation = await strapi.documents(SAVED_CREATION_UID as any).create({
        data: {
          magentoCustomerId,
          creation: creationDocumentId,
          saveKey: key,
        },
        populate: creationPopulate,
      } as any);

      ctx.status = 201;
      return {
        data: publicSavedCreation(savedCreation),
        meta: { alreadySaved: false },
      };
    } catch (error) {
      if (error instanceof Error && /unique|duplicate|saveKey/i.test(error.message)) {
        const savedCreation = await strapi.documents(SAVED_CREATION_UID as any).findFirst({
          filters: { saveKey: key },
          populate: creationPopulate,
        } as any);

        if (savedCreation) {
          return {
            data: publicSavedCreation(savedCreation),
            meta: { alreadySaved: true },
          };
        }
      }

      throw error;
    }
  },

  async listForCustomer(ctx) {
    const magentoCustomerId = ctx.state.magentoCustomer.id;
    const requestedPage = Number(ctx.query.page);
    const requestedPageSize = Number(ctx.query.pageSize);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize =
      Number.isInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, 100)
        : 20;
    const filters = { magentoCustomerId };
    const documentService = strapi.documents(SAVED_CREATION_UID as any);

    const [savedCreations, total] = await Promise.all([
      documentService.findMany({
        filters,
        populate: creationPopulate,
        sort: ['createdAt:desc'],
        pagination: { page, pageSize },
      } as any),
      documentService.count({ filters } as any),
    ]);

    return {
      data: savedCreations.map(publicSavedCreation),
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
          total,
        },
      },
    };
  },

  async deleteForCustomer(ctx) {
    const creationDocumentId = documentIdOrUndefined(ctx.params.creationDocumentId);
    if (!creationDocumentId) {
      return ctx.badRequest('creationDocumentId is required.');
    }

    const key = saveKey(ctx.state.magentoCustomer.id, creationDocumentId);
    const existing = await strapi.documents(SAVED_CREATION_UID as any).findFirst({
      filters: { saveKey: key },
    } as any);
    if (!existing) {
      return ctx.notFound('Saved creation not found.');
    }

    await strapi.documents(SAVED_CREATION_UID as any).delete({
      documentId: existing.documentId,
    } as any);

    ctx.status = 204;
    ctx.body = null;
  },
}));
