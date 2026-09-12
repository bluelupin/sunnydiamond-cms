import { factories } from '@strapi/strapi';
import { blogPostPopulate } from '../../../utils/blog-populate';
import { relatedBlogFilters } from '../../../utils/blog-tags';

const WORDS_PER_MINUTE = 200;

const wordCount = (body: unknown) => {
  if (typeof body !== 'string') return 0;

  const plainText = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, ' ')
    .replace(/[`*_>#~|=-]/g, ' ');

  return plainText.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
};

const addReadTime = (blogPost: any) => {
  if (!blogPost) return blogPost;

  const readTimeMinutes = Math.max(
    1,
    Math.ceil(wordCount(blogPost.body) / WORDS_PER_MINUTE)
  );
  const calculatedLabel = `${readTimeMinutes} min read`;
  const manualLabel =
    typeof blogPost.duration === 'string' && blogPost.duration.trim()
      ? blogPost.duration.trim()
      : undefined;

  return {
    ...blogPost,
    duration: manualLabel ?? calculatedLabel,
    readTimeMinutes,
    readTimeLabel: manualLabel ?? calculatedLabel,
  };
};

export default factories.createCoreController('api::blog-post.blog-post' as any, ({ strapi }) => ({
  async related(ctx) {
    await this.validateQuery(ctx);
    const query = await this.sanitizeQuery(ctx);
    const page = Number((query.pagination as { page?: unknown } | undefined)?.page ?? 1);
    const pageSize = 3;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(page * pageSize)) {
      return ctx.badRequest('pagination[page] must be a positive integer.');
    }
    const paginationMeta = (total: number) => ({
      pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total },
    });
    const source = await strapi.documents('api::blog-post.blog-post').findFirst({
      filters: { slug: { $eq: ctx.params.slug } },
      locale: query.locale,
      status: 'published',
      populate: { blogTags: true },
    } as any) as any;

    if (!source) return ctx.notFound('Blog not found');
    const tagIds = (source.blogTags ?? []).map((tag: any) => tag.documentId);
    if (!tagIds.length) return this.transformResponse([], paginationMeta(0));

    const filters = relatedBlogFilters(source.documentId, tagIds);
    const documentService = strapi.documents('api::blog-post.blog-post');
    const criteria = {
      locale: source.locale,
      status: 'published' as const,
      filters,
    };
    const [related, total] = await Promise.all([
      documentService.findMany({
        ...criteria,
        sort: ['publishedDate:desc', 'publishedAt:desc', 'documentId:asc'],
        start: (page - 1) * pageSize,
        limit: pageSize,
        populate: blogPostPopulate,
      } as any),
      documentService.count(criteria as any),
    ]);
    const sanitized = await this.sanitizeOutput(related, ctx) as any[];
    return this.transformResponse(sanitized.map(addReadTime), paginationMeta(total));
  },

  async find(ctx) {
    if (ctx.query.populate === '*') {
      ctx.query = { ...ctx.query, populate: blogPostPopulate } as any;
    }

    const response = await super.find(ctx);

    return {
      ...response,
      data: Array.isArray(response.data)
        ? response.data.map(addReadTime)
        : response.data,
    };
  },

  async findOne(ctx) {
    if (ctx.query.populate === '*') {
      ctx.query = { ...ctx.query, populate: blogPostPopulate } as any;
    }

    const response = await super.findOne(ctx);

    return {
      ...response,
      data: addReadTime(response.data),
    };
  },
}));
