import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const BLOG_ROOT = 'https://sunnydiamonds.com/blog/';
const OUTPUT_PATH = resolve('src/data/blog-posts.json');
const CONCURRENCY = 6;

const decodeHtml = (value = '') =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(
      /&(nbsp|amp|quot|apos|lt|gt|#039|hellip|ndash|mdash|lsquo|rsquo|ldquo|rdquo);/gi,
      (entity) =>
        ({
          '&nbsp;': ' ',
          '&amp;': '&',
          '&quot;': '"',
          '&apos;': "'",
          '&lt;': '<',
          '&gt;': '>',
          '&#039;': "'",
          '&hellip;': '…',
          '&ndash;': '–',
          '&mdash;': '—',
          '&lsquo;': '‘',
          '&rsquo;': '’',
          '&ldquo;': '“',
          '&rdquo;': '”',
        })[entity.toLowerCase()] ?? entity
    );

const plainText = (html = '') =>
  decodeHtml(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();

const htmlToMarkdown = (html = '') =>
  decodeHtml(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<p[^>]*>\s*(?:<a[^>]*>)?\s*<img[^>]*Banner\.(?:png|jpe?g|webp)[^>]*>\s*(?:<\/a>)?\s*<\/p>/gi, '')
      .replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '\n\n![$2]($1)\n\n')
      .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, '\n\n![$1]($2)\n\n')
      .replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n\n![]($1)\n\n')
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n## $1\n\n')
      .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
      .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

async function fetchHtml(url, attempt = 1) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'SunnyDiamonds-CMS-Blog-Migration/1.0' },
  });

  if (!response.ok) {
    if (attempt < 3 && response.status >= 500) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * attempt));
      return fetchHtml(url, attempt + 1);
    }
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return response.text();
}

function parseListing(html) {
  return [...html.matchAll(/<li\b[^>]*class=["'][^"']*\bpost\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)]
    .map(([, item]) => {
      const url = item.match(/<h2\b[^>]*class=["'][^"']*post-name[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)/i)?.[1];
      const titleHtml = item.match(/<h2\b[^>]*class=["'][^"']*post-name[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
      return url ? { url, listingTitle: plainText(titleHtml) } : null;
    })
    .filter(Boolean);
}

function getSection(html, startPattern, endPattern) {
  const start = html.search(startPattern);
  if (start < 0) return '';
  const sliced = html.slice(start);
  const contentStart = sliced.indexOf('>') + 1;
  const end = sliced.slice(contentStart).search(endPattern);
  return end < 0
    ? sliced.slice(contentStart)
    : sliced.slice(contentStart, contentStart + end);
}

function toIsoDate(rawDate) {
  if (!rawDate) return null;
  const match = rawDate.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (!match) return null;

  const months = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const month = months[match[2].toLowerCase()];
  if (!month) return null;

  return `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

async function parsePost({ url, listingTitle }) {
  const html = await fetchHtml(url);
  const slug = new URL(url).pathname.split('/').filter(Boolean).at(-1);
  const title = plainText(
    html.match(/<h2\b[^>]*class=["'][^"']*blog-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]
  ) || listingTitle;

  const rawContent = getSection(
    html,
    /<div\b[^>]*class=["'][^"']*post-content[^"']*["'][^>]*>/i,
    /<div\b[^>]*class=["'][^"']*post-meta(?:\s|["'])/i
  );
  const titleEnd = rawContent.search(/<\/h2>/i);
  const articleHtml = titleEnd >= 0 ? rawContent.slice(titleEnd + 5) : rawContent;
  const body = htmlToMarkdown(articleHtml.replace(/<\/div>\s*<\/div>\s*$/i, ''));

  const categoriesHtml = getSection(
    html,
    /<div\b[^>]*class=["'][^"']*post-categories[^"']*["'][^>]*>/i,
    /<div\b[^>]*class=["'][^"']*post-date(?:\s|["'])/i
  );
  const tagLabels = [...categoriesHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => plainText(match[1]).replace(/,\s*$/, '').trim())
    .filter(Boolean);
  const uniqueTagLabels = [...new Set(tagLabels)];
  const tags = uniqueTagLabels.map((label) => ({ label: label.slice(0, 255) }));

  const rawDate = plainText(
    html.match(/<div\b[^>]*class=["'][^"']*post-date[^"']*["'][^>]*>[\s\S]*?<\/strong>([\s\S]*?)<\/div>/i)?.[1]
  );
  const authorName = plainText(
    html.match(/<div\b[^>]*class=["'][^"']*post-user[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1]
  ) || 'Sunny';
  const firstParagraph = [...articleHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => plainText(match[1]))
    .find(Boolean);
  const excerpt = (firstParagraph || plainText(articleHtml)).slice(0, 500);
  const safeTitle = title.slice(0, 255);

  return {
    slug,
    tags,
    isFeatured: false,
    title: safeTitle,
    authorName: authorName.slice(0, 255),
    publishedDate: toIsoDate(rawDate),
    excerpt,
    heroImage: null,
    coverImage: null,
    body: body || 'Content migrated from the previous Sunny Diamonds website.',
    seo: {
      metaTitle: safeTitle,
      metaDescription: excerpt,
      canonicalUrl: url,
      metaKeywords: uniqueTagLabels.join(', ').slice(0, 255),
      showField: true,
    },
  };
}

async function mapConcurrent(values, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, values.length) }, worker));
  return results;
}

async function main() {
  const listings = [];

  for (let page = 1; page <= 100; page += 1) {
    const url = page === 1 ? BLOG_ROOT : `${BLOG_ROOT}page/${page}/`;
    let html;
    try {
      html = await fetchHtml(url);
    } catch (error) {
      if (String(error).includes('404 Not Found')) break;
      throw error;
    }
    const posts = parseListing(html);
    if (!posts.length) break;
    listings.push(...posts);
    process.stdout.write(`Found ${listings.length} posts through page ${page}\n`);
  }

  const uniqueListings = [...new Map(listings.map((post) => [post.url, post])).values()];
  const posts = await mapConcurrent(uniqueListings, async (post, index) => {
    const parsed = await parsePost(post);
    process.stdout.write(`Fetched ${index + 1}/${uniqueListings.length}: ${parsed.slug}\n`);
    return parsed;
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${posts.length} posts to ${OUTPUT_PATH}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
