# Sunny Diamond CMS

Strapi CMS for Sunny Diamonds editorial and page content.

## Setup

Install dependencies:

```bash
npm install
```

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Generate Strapi Secrets

Do not reuse the placeholder values from `.env.example`. Generate unique values for every environment.

Use OpenSSL:

```bash

for k in APP_KEYS API_TOKEN_SALT ADMIN_JWT_SECRET TRANSFER_TOKEN_SALT JWT_SECRET ENCRYPTION_KEY; do
  echo "$k=$(openssl rand -base64 32)"
done
```
## Upload Provider

By default, Strapi uses the local upload provider.

To use AWS S3 with CloudFront delivery, set `UPLOAD_PROVIDER=aws-s3` and configure:

```env
UPLOAD_PROVIDER=aws-s3
AWS_ACCESS_KEY_ID=
AWS_ACCESS_SECRET=
AWS_REGION=
AWS_BUCKET=
AWS_ACL=public-read
AWS_SIGNED_URL_EXPIRES=900
CDN_URL=https://your-cloudfront-domain.cloudfront.net
CDN_ROOT_PATH=uploads
```

## Scripts

Start Strapi in development:

```bash
npm run develop
```

Build the admin panel:

```bash
npm run build
```

Start Strapi without auto-reload:

```bash
npm run start
```

## Deployment

If deploying from the outer repository folder, use this app as the root directory:

```txt
sunnydiamond-cms
```

Strapi does not need a separate web/static directory. The deployment platform should run the Node app.

Typical deployment commands:

```txt
Install Command: npm install
Build Command: npm run build
Start Command: npm run start
```
