import type { Core } from '@strapi/strapi';

type RevalidationMapping = {
  tags: string[];
  paths?: string[];
  slugPaths?: string[];
  formTagTags?: string[];
};

type LifecycleEvent = {
  action?: string;
  model?: {
    uid?: string;
  };
  result?: {
    id?: number | string;
    documentId?: string;
    slug?: string;
    formTag?: string;
    publishedAt?: string | null;
    updatedAt?: string;
  };
};

const REVALIDATION_MAPPINGS: Record<string, RevalidationMapping> = {
  'api::homepage.homepage': {
    tags: ['cms:homepage'],
    paths: ['/'],
  },
  'api::global-config.global-config': {
    tags: ['cms:global-config'],
  },
  'api::about-page.about-page': {
    tags: ['cms:about-page'],
    paths: ['/world-of-sunny'],
  },
  'api::contact-bespoke-page.contact-bespoke-page': {
    tags: ['cms:contact-bespoke-page'],
    paths: ['/bespoke-jewellery', '/contact'],
  },
  'api::learn-about-diamonds-page.learn-about-diamonds-page': {
    tags: ['cms:learn-about-diamonds-page'],
    paths: ['/learn-about-diamonds'],
  },
  'api::product-landing-page.product-landing-page': {
    tags: ['cms:product-landing-page'],
    paths: ['/diamonds-for-everyone'],
  },
  'api::blog-post.blog-post': {
    tags: ['cms:blog-post'],
    paths: ['/blogs'],
    slugPaths: ['/blogs/:slug'],
  },
  'api::blog-landing-page.blog-landing-page': {
    tags: ['cms:blog-landing-page'],
    paths: ['/blogs'],
  },
  'api::blog-category.blog-category': {
    tags: ['cms:blog-category', 'cms:blog-post'],
    paths: ['/blogs'],
  },
  'api::news-article.news-article': {
    tags: ['cms:news-article'],
    paths: ['/news'],
    slugPaths: ['/news/:slug'],
  },
  'api::legal-page.legal-page': {
    tags: ['cms:legal-page'],
    slugPaths: ['/:slug'],
  },
  'api::support-page.support-page': {
    tags: ['cms:support-page'],
    paths: ['/help-and-support'],
    slugPaths: ['/:slug'],
  },
  'api::showroom.showroom': {
    tags: ['cms:showroom'],
    paths: ['/store-locator'],
  },
  'api::occasion.occasion': {
    tags: ['cms:occasion', 'cms:homepage'],
    paths: ['/', '/occasions'],
    slugPaths: ['/occasions/:slug'],
  },
  'api::category-landing.category-landing': {
    tags: ['cms:category-landing'],
    slugPaths: ['/category/:slug'],
  },
  'api::service-page.service-page': {
    tags: ['cms:service-page'],
    slugPaths: ['/:slug'],
  },
  'api::career-opening.career-opening': {
    tags: ['cms:career-opening'],
    paths: ['/careers'],
    slugPaths: ['/careers/:slug'],
  },
  'api::career-landing-page.career-landing-page': {
    tags: ['cms:career-landing-page'],
    paths: ['/careers'],
  },
  'api::career-listing-page.career-listing-page': {
    tags: ['cms:career-listing-page', 'cms:career-opening'],
    paths: ['/careers'],
  },
  'api::editorial-collection.editorial-collection': {
    tags: ['cms:editorial-collection'],
    paths: ['/collections'],
    slugPaths: ['/collections/:slug'],
  },
  'api::faq.faq': {
    tags: ['cms:faq'],
    paths: ['/faqs'],
  },
  'api::product-form.product-form': {
    tags: ['cms:product-form'],
    formTagTags: ['cms:product-form:formTag'],
  },
  'api::generic-form.generic-form': {
    tags: ['cms:generic-form'],
    formTagTags: ['cms:generic-form:formTag'],
  },
  'api::state.state': {
    tags: ['cms:state', 'cms:product-form'],
  },
};

const revalidationModels = Object.keys(REVALIDATION_MAPPINGS);

const envBool = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) return defaultValue;
  return value === 'true';
};

const replaceSlug = (path: string, slug: string) => path.replace(':slug', slug);

const buildPayload = (uid: string, event: LifecycleEvent) => {
  const mapping = REVALIDATION_MAPPINGS[uid];
  const result = event.result || {};
  const slug = result.slug;
  const formTag = result.formTag;
  const tags = new Set(mapping.tags);
  const paths = new Set(mapping.paths || []);

  if (slug) {
    tags.add(`cms:${uid.split('.')[1]}:${slug}`);
    for (const path of mapping.slugPaths || []) {
      paths.add(replaceSlug(path, slug));
    }
  }

  if (formTag) {
    for (const tag of mapping.formTagTags || []) {
      tags.add(tag.replace('formTag', formTag));
    }
  }

  return {
    source: 'strapi',
    uid,
    action: event.action,
    entry: {
      id: result.id,
      documentId: result.documentId,
      slug,
      formTag,
      publishedAt: result.publishedAt,
      updatedAt: result.updatedAt,
    },
    tags: Array.from(tags),
    paths: Array.from(paths),
  };
};

const postRevalidation = async (strapi: Core.Strapi, uid: string, event: LifecycleEvent) => {
  const url = process.env.FRONTEND_REVALIDATE_URL;
  if (!url || !envBool(process.env.FRONTEND_REVALIDATE_ENABLED, true)) return;

  const secret = process.env.FRONTEND_REVALIDATE_SECRET;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildPayload(uid, event)),
    });

    if (!response.ok) {
      strapi.log.warn(`Frontend revalidation failed for ${uid}: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    strapi.log.warn(`Frontend revalidation request failed for ${uid}`, error);
  }
};

const queueRevalidation = (strapi: Core.Strapi, event: LifecycleEvent) => {
  const uid = event.model?.uid;
  if (!uid || !REVALIDATION_MAPPINGS[uid]) return;

  setTimeout(() => {
    void postRevalidation(strapi, uid, event);
  }, 0);
};

export const registerFrontendRevalidation = (strapi: Core.Strapi) => {
  strapi.db.lifecycles.subscribe({
    models: revalidationModels,
    afterCreate(event: LifecycleEvent) {
      queueRevalidation(strapi, event);
    },
    afterUpdate(event: LifecycleEvent) {
      queueRevalidation(strapi, event);
    },
    afterDelete(event: LifecycleEvent) {
      queueRevalidation(strapi, event);
    },
  });
};
