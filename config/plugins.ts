import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const uploadMaxFileSize = env.int('UPLOAD_MAX_FILE_SIZE', 25 * 1024 * 1024);
  const plugins: Core.Config.Plugin = {
    'form-export': {
      enabled: true,
      resolve: './src/plugins/form-export',
    },
    upload: {
      config: {
        sizeLimit: uploadMaxFileSize,
      },
    },
    ckeditor: {
    enabled: true,
    resolve: "./src/plugins/strapi-plugin-ckeditor"
  },
  };

  if (env('UPLOAD_PROVIDER') === 'aws-s3') {
    plugins.upload = {
      config: {
        sizeLimit: uploadMaxFileSize,
        provider: 'aws-s3',
        providerOptions: {
          baseUrl: env('CDN_URL'),
          rootPath: env('CDN_ROOT_PATH'),
          s3Options: {
            credentials: {
              accessKeyId: env('AWS_ACCESS_KEY_ID'),
              secretAccessKey: env('AWS_ACCESS_SECRET'),
            },
            region: env('AWS_REGION'),
            params: {
              // Bucket has ACLs disabled (owner-enforced); reads go through CloudFront OAC.
              // ACL must be explicitly undefined — omitting the key makes the provider
              // default it to 'public-read', which the bucket rejects.
              ACL: undefined,
              Bucket: env('AWS_BUCKET'),
            },
          },
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
    };
  }

  return plugins;
};

export default config;
