import { factories } from '@strapi/strapi';
import { blogPostPopulate } from '../../../utils/blog-populate';

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

export default factories.createCoreController('api::blog-post.blog-post' as any, () => ({
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
