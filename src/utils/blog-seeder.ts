import type { Core } from '@strapi/strapi';
import blogPosts from '../data/blog-posts.json';

const MarkdownIt = require('markdown-it');

const BLOG_POST_UID = 'api::blog-post.blog-post';
const BLOG_LOCALE = 'en';
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false });

type BlogMedia = {
  id: number;
  name: string;
  url: string;
  alternativeText?: string | null;
};

type ResolvedBlogMedia = BlogMedia & { absoluteUrl: string };
type BlogMediaPair = {
  banner?: ResolvedBlogMedia;
  hero?: ResolvedBlogMedia;
  body: Map<string, ResolvedBlogMedia>;
};

const BODY_IMAGE_TOKEN = /<p>\{\{BLOG_BODY_IMAGE_(\d+)\}\}<\/p>/g;

const stripMarkdownImages = (body: string) =>
  body
    .replace(/\[\s*!\[[^\]]*\]\([^\r\n)]+\)\s*\]\([^\r\n)]+\)/g, '')
    .replace(/!\[[^\]]*\]\([^\r\n)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const imageFigure = (media: ResolvedBlogMedia, altText: string) =>
  `<figure class="image"><img src="${escapeHtml(media.absoluteUrl)}" alt="${escapeHtml(altText)}"></figure>`;

function renderBody(
  post: (typeof blogPosts)[number],
  bodyMedia: ResolvedBlogMedia[],
  heroMedia?: ResolvedBlogMedia
) {
  const cleanBody = stripMarkdownImages(post.body);
  const tokenCount = (post.body.match(/\{\{BLOG_BODY_IMAGE_\d+\}\}/g) || []).length;
  const inlineMedia = tokenCount === bodyMedia.length + 1 && heroMedia
    ? [heroMedia, ...bodyMedia]
    : bodyMedia;
  const usedMedia = new Set<number>();
  let bodyHtml = markdown.render(cleanBody).trim();

  bodyHtml = bodyHtml.replace(BODY_IMAGE_TOKEN, (_token, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    const media = inlineMedia[index];
    if (!media) return '';

    usedMedia.add(index);
    return imageFigure(media, media.alternativeText || `${post.title} image ${index + 1}`);
  });

  const remainingImages = inlineMedia
    .map((media, index) => ({ media, index }))
    .filter(({ index }) => !usedMedia.has(index))
    .map(({ media, index }) => imageFigure(media, media.alternativeText || `${post.title} image ${index + 1}`));

  return [bodyHtml, ...remainingImages].filter(Boolean).join('\n');
}

function getAbsoluteMediaUrl(strapi: Core.Strapi, url: string) {
  try {
    return new URL(url).toString();
  } catch {
    const baseUrl = process.env.CDN_URL || strapi.config.get<string>('server.url');
    if (!baseUrl) return null;

    try {
      return new URL(url, `${baseUrl.replace(/\/$/, '')}/`).toString();
    } catch {
      return null;
    }
  }
}

async function getBlogMedia(strapi: Core.Strapi) {
  const files = (await strapi.db.query('plugin::upload.file').findMany({
    select: ['id', 'name', 'url', 'alternativeText'],
    orderBy: { id: 'desc' },
  } as any)) as BlogMedia[];
  const mediaByNumber = new Map<number, BlogMediaPair>();

  for (const file of files) {
    const match = file.name.match(/^blog0*(\d+)-([^.]+)\.[^.]+$/i);
    if (!match) continue;

    const absoluteUrl = getAbsoluteMediaUrl(strapi, file.url);
    if (!absoluteUrl) continue;

    const number = Number(match[1]);
    const suffix = match[2].toLowerCase();
    const pair = mediaByNumber.get(number) || { body: new Map<string, ResolvedBlogMedia>() };
    const resolved = { ...file, absoluteUrl };

    if (suffix === 'heroimage' && !pair.hero) pair.hero = resolved;
    else if (suffix === 'bannerimage' && !pair.banner) pair.banner = resolved;
    else if (!pair.body.has(suffix)) pair.body.set(suffix, resolved);

    mediaByNumber.set(number, pair);
  }

  return mediaByNumber;
}

export async function seedBlogPosts(strapi: Core.Strapi) {
  if (process.env.BLOG_SEED_ENABLED !== 'true') {
    strapi.log.info('Blog seeding is disabled. Skipping blog post seeding.');
    return;
  }

  const mediaByNumber = await getBlogMedia(strapi);
  const missingMedia = blogPosts
    .map((_, index) => index + 1)
    .filter((number) => !mediaByNumber.get(number)?.banner);

  if (missingMedia.length) {
    strapi.log.error(
      `Blog seeding stopped. Missing banner media: ${missingMedia.map((number) => `blog${number}-bannerimage`).join(', ')}`
    );
    return;
  }

  strapi.log.info(`Seeding ${blogPosts.length} blog posts with blog1-blog${blogPosts.length} media...`);

  for (const [index, post] of blogPosts.entries()) {
    try {
      const media = mediaByNumber.get(index + 1)!;
      const coverMedia = media.banner!;
      const heroMedia = media.hero || coverMedia;
      const bodyMedia = [...media.body.values()].sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      const coverAltText = coverMedia.alternativeText || post.title;
      const heroAltText = heroMedia.alternativeText || post.title;
      const seededPost = {
        ...post,
        body: renderBody(post, bodyMedia, media.hero),
        heroImage: {
          desktopImage: heroMedia.id,
          mobileImage: heroMedia.id,
          altText: heroAltText,
        },
        coverImage: {
          desktopImage: coverMedia.id,
          mobileImage: coverMedia.id,
          altText: coverAltText,
        },
      };
      const existing = await strapi.documents(BLOG_POST_UID).findFirst({
        filters: { slug: post.slug },
        locale: BLOG_LOCALE,
      } as any);

      if (existing) {
        await strapi.documents(BLOG_POST_UID).update({
          documentId: existing.documentId,
          data: seededPost,
          locale: BLOG_LOCALE,
        } as any);
        await strapi.documents(BLOG_POST_UID).publish({
          documentId: existing.documentId,
          locale: BLOG_LOCALE,
        } as any);
        strapi.log.info(`Updated blog: ${post.slug}`);
        continue;
      }

      const created = await strapi.documents(BLOG_POST_UID).create({
        data: seededPost,
        locale: BLOG_LOCALE,
      } as any);
      await strapi.documents(BLOG_POST_UID).publish({
        documentId: created.documentId,
        locale: BLOG_LOCALE,
      } as any);
      strapi.log.info(`Created blog: ${post.slug}`);
    } catch (error) {
      strapi.log.error(`Failed to seed blog ${post.slug}`, error);
    }
  }
}
