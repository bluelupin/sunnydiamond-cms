import type { Core } from '@strapi/strapi';

const uploadMaxFileSize = Number(process.env.UPLOAD_MAX_FILE_SIZE || 25 * 1024 * 1024);

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
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
