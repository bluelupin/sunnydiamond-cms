import type { Core } from '@strapi/strapi';
import blogPosts from '../data/blog-posts.json';

const BLOG_POST_UID = 'api::blog-post.blog-post';
const BLOG_LOCALE = 'en';

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
};

const stripMarkdownImages = (body: string) =>
  body
    .replace(/\[\s*!\[[^\]]*\]\([^\r\n)]+\)\s*\]\([^\r\n)]+\)/g, '')
    .replace(/!\[[^\]]*\]\([^\r\n)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const escapeMarkdownAlt = (value: string) => value.replace(/[\[\]\\]/g, '\\$&');

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
    const match = file.name.match(/^blog0*(\d+)-(hero|banner)image(?:\D|$)/i);
    if (!match) continue;

    const absoluteUrl = getAbsoluteMediaUrl(strapi, file.url);
    if (!absoluteUrl) continue;

    const number = Number(match[1]);
    const type = match[2].toLowerCase() as 'hero' | 'banner';
    const pair = mediaByNumber.get(number) || {};
    if (!pair[type]) pair[type] = { ...file, absoluteUrl };
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
      const coverAltText = coverMedia.alternativeText || post.title;
      const heroAltText = heroMedia.alternativeText || post.title;
      const cleanBody = stripMarkdownImages(post.body);
      const imageMarkdown = `![${escapeMarkdownAlt(heroAltText)}](${heroMedia.absoluteUrl})`;
      const seededPost = {
        ...post,
        body: `${imageMarkdown}\n\n${cleanBody}`,
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
          status: 'published',
        } as any);
        strapi.log.info(`Updated blog: ${post.slug}`);
        continue;
      }

      await strapi.documents(BLOG_POST_UID).create({
        data: seededPost,
        locale: BLOG_LOCALE,
        status: 'published',
      } as any);
      strapi.log.info(`Created blog: ${post.slug}`);
    } catch (error) {
      strapi.log.error(`Failed to seed blog ${post.slug}`, error);
    }
  }
}
