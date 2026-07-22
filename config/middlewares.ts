import type { Core } from '@strapi/strapi';

const uploadMaxFileSize = Number(process.env.UPLOAD_MAX_FILE_SIZE || 25 * 1024 * 1024);
const cdnHost = (process.env.CDN_URL || '').replace(/^https?:\/\//, '').split('/')[0];

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', ...(cdnHost ? [cdnHost] : [])],
          'media-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', ...(cdnHost ? [cdnHost] : [])],
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      jsonLimit: '25mb',
      formLimit: '25mb',
      textLimit: '25mb',
      formidable: {
        maxFileSize: uploadMaxFileSize,
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
