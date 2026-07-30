import type { Core } from '@strapi/strapi';
import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

// ==========================================
// DYNAMIC URL CRAWLER WITH FOOLPROOF FILTER
// ==========================================
async function fetchBlogUrls(strapi: Core.Strapi): Promise<string[]> {
  const dynamicUrls: string[] = [];
  let currentPage = 1;
  let hasMorePages = true;

  strapi.log.info('\n🔍 Scanning main blog pages for URLs...');

  while (hasMorePages) {
    const pageUrl = currentPage === 1 
      ? 'https://sunnydiamonds.com/blog/' 
      : `https://sunnydiamonds.com/blog/page/${currentPage}/`;

    strapi.log.info(`📄 Scraping page ${currentPage}: ${pageUrl}`);

    try {
      const { data: html } = await axios.get(pageUrl);
      const $ = cheerio.load(html);
      let urlsFoundOnPage = 0;

      $('a').each((i, el) => {
        let href = $(el).attr('href');
        
        if (href && href.includes('/blog/')) {
          if (href.startsWith('/')) {
              href = `https://sunnydiamonds.com${href}`;
          }

          // Strictly ignore landing pages, pagination roots, and category pages
          const isLandingPage = href === 'https://sunnydiamonds.com/blog/' || 
                                href === 'https://sunnydiamonds.com/blog' ||
                                href.endsWith('/blog') ||
                                href.includes('/category/') || 
                                href.includes('/page/');

          if (!isLandingPage && !dynamicUrls.includes(href)) {
            dynamicUrls.push(href);
            urlsFoundOnPage++;
          }
        }
      });

      if (urlsFoundOnPage === 0) {
        hasMorePages = false;
      } else {
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        hasMorePages = false;
      } else {
        strapi.log.error(`❌ Failed to fetch ${pageUrl}:`, error.message);
        hasMorePages = false; 
      }
    }
  }

  strapi.log.info(`\n🎯 DONE CRAWLING! Found a total of ${dynamicUrls.length} unique blog posts.`);
  return dynamicUrls;
}

// ==========================================
// MAIN SEEDER LOGIC
// ==========================================
async function processBlog(blogUrl: string, strapi: Core.Strapi) {
  let payload: Record<string, any> = {};

  try {
    strapi.log.info(`\n⏳ Migrating: ${blogUrl}`);
    const { data: html } = await axios.get(blogUrl);
    const $ = cheerio.load(html);

    // ==========================================
    // 1. EXTRACT EXACT VISUAL BODY HEADING ONLY
    // ==========================================
    // Pulls the visible article title from the page body, totally ignoring the head SEO title tag
    let rawTitle = $('h1').first().text().trim() 
                || $('h2').first().text().trim()
                || $('.column.main h1, .column.main h2').first().text().trim();

    if (!rawTitle || rawTitle.toLowerCase().includes('forgot password') || rawTitle.toLowerCase() === 'blog') {
        const fallbackSlug = blogUrl.split('/').filter(Boolean).pop() || '';
        rawTitle = fallbackSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Safely enforce maximum 255 character limit for database short-text fields
    const title = rawTitle.length > 255 ? rawTitle.substring(0, 252) + '...' : rawTitle;
    
    let slug = blogUrl.split('/').filter(Boolean).pop();
    if (!slug || slug === 'blog') {
        slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    }
    
    const pageText = $('body').text().replace(/\s+/g, ' '); 
    
    const categoriesMatch = pageText.match(/Categories:\s*(.*?)(?:\s*Tags\s*:|\s*Posted On)/i);
    const rawCategories = categoriesMatch ? categoriesMatch[1].replace(/,\s*$/, '').trim() : '';

    const tagsMatch = pageText.match(/Tags\s*:\s*(.*?)(?:\s*Posted On)/i);
    const rawTags = tagsMatch ? tagsMatch[1].replace(/,\s*$/, '').trim() : '';

    let metaKeywords = [rawCategories, rawTags].filter(Boolean).join(', ');
    if (metaKeywords.length > 250) {
        metaKeywords = metaKeywords.substring(0, 250);
    }
    if (!metaKeywords) metaKeywords = 'General';

    let rawTagsList = [rawCategories, rawTags].filter(Boolean).join(',').split(',');
    let finalTagsList: string[] = [];

    for (let t of rawTagsList) {
        t = t.trim();
        if (!t) continue;
        
        if (t.length > 50) {
            finalTagsList.push(...t.split(' ').map(s => s.trim()).filter(Boolean));
        } else {
            finalTagsList.push(t);
        }
    }

    const tagsArray = [...new Set(finalTagsList)].map(label => ({ label: label.substring(0, 255) }));
    
    const dateMatch = pageText.match(/\d{1,2}\s+[A-Za-z]+,\s+\d{4}/);
    const rawDate = dateMatch ? dateMatch[0] : '4 November, 2023'; 
    const dateObj = new Date(rawDate);
    
    let formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    if (formattedDate.includes('NaN')) {
        const today = new Date();
        formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    // ==========================================
    // 2. EXTRACT & CLEAN HTML BODY CONTENT
    // ==========================================
    let $content = $('body').clone();

    $content.find('style, script, noscript').remove(); 
    $content.find('form, .modal, .popup, .form-customer-login, #social-form-password-forget').remove(); 
    $content.find('header, nav, footer, .header, .footer, .menu, .sidebar, .breadcrumbs, .page-header').remove();

    // Remove the title heading from the body markdown so it doesn't duplicate
    $content.find('h1').remove();
    
    const titleSnippet = title.substring(0, 15).toLowerCase();
    $content.find('h2, h3').each((i, el) => {
        if ($(el).text().toLowerCase().includes(titleSnippet)) {
            $(el).remove();
        }
    });

    $content.find('img[src*="Banner.png"]').remove();
    $content.find('img[src*="banner.png"]').remove();
    
    let bodyHtml = $content.find('.column.main').html() || $content.find('.post-content').html() || $content.html();

    // ==========================================
    // 3. MARKDOWN CONVERSION & CLEANUP
    // ==========================================
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    
    turndownService.addRule('forceH2', {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      replacement: function (content) {
        const cleanContent = content.replace(/[\*_]/g, '').trim();
        return `\n\n## ${cleanContent}\n\n`;
      }
    });

    let markdownBody = turndownService.turndown(bodyHtml || '');

    const escapedSnippet = titleSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const titleRegex = new RegExp(`^(?:#+\\s*)?${escapedSnippet}.*$`, 'gim');
    markdownBody = markdownBody.replace(titleRegex, ''); 
    
    markdownBody = markdownBody.replace(/## Forgot Password/gi, '');
    markdownBody = markdownBody.replace(/Be in the know of Diamonds with Sunny Diamonds\.?/gi, '');

    const categoryIndex = markdownBody.indexOf('Categories:');
    if (categoryIndex !== -1) markdownBody = markdownBody.substring(0, categoryIndex);
    
    const postedOnIndex = markdownBody.indexOf('Posted On:');
    if (postedOnIndex !== -1) markdownBody = markdownBody.substring(0, postedOnIndex);

    markdownBody = markdownBody.replace(/\*\*\s*$/, '');
    markdownBody = markdownBody.trim();
    
    if (!markdownBody) {
        markdownBody = "Content migrated from previous website.";
    }

    // ==========================================
    // 4. FINAL STRAPI PAYLOAD
    // ==========================================
    payload = {
      title: title,                    // Exact visual heading from the old page body
      slug: slug, 
      authorName: 'Sunny',
      publishedDate: formattedDate,
      excerpt: "", 
      tags: tagsArray, 
      body: markdownBody, 
      isFeatured: false, 
      HeroImage: null,
      coverImage: null, 
      seo: {
        metaTitle: title,              // Identical match to the title field
        metaDescription: "", 
        canonicalUrl: "", 
        metaKeywords: metaKeywords, 
        showField: true 
      }
    };

    const existingEntry = await strapi.documents('api::blog-post.blog-post').findFirst({
        filters: { slug: slug }
    } as any);

    if (existingEntry) {
        strapi.log.info(`🔄 Updating existing entry: "${title}"`);
        await strapi.documents('api::blog-post.blog-post').update({
            documentId: existingEntry.documentId,
            data: payload,
            status: 'published'
        } as any);
        return;
    }

    await strapi.documents('api::blog-post.blog-post').create({
        data: payload,
        status: 'published'
    } as any);
    
    strapi.log.info(`✅ Successfully Seeded: "${title}"`);

  } catch (error: any) {
    strapi.log.error(`❌ Failed on ${blogUrl}:`, error);
  }
}

// ==========================================
// EXPORTED SEEDER FUNCTION
// ==========================================
export async function seedBlogPosts(strapi: Core.Strapi) {
  strapi.log.info('Starting Strapi Blog programmatic scraping and seeding process...');
  
  try {
    const scrapedUrls = await fetchBlogUrls(strapi);
    
    if (scrapedUrls.length === 0) {
      strapi.log.warn("⚠️ No URLs found. Exiting Blog Seeder.");
      return;
    }

    strapi.log.info(`\n🚀 Starting internal migration for ${scrapedUrls.length} blogs...`);
    
    for (const url of scrapedUrls) {
      await processBlog(url, strapi);
      await new Promise(resolve => setTimeout(resolve, 500)); 
    }
    
    strapi.log.info(`\n🎉 All blog migrations completed!`);
  } catch (error) {
    strapi.log.error('An error occurred during Blog seeding:', error);
  }
}