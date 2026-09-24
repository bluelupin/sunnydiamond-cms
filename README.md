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

## Resume autofill API

Set `RESUME_PARSER_ENABLED=true` and `OPENAI_API_KEY` on the server. Optional
`OPENAI_RESUME_MODEL` defaults to `gpt-4.1-mini`. Use Node 22.13+ and the
installed `@napi-rs/canvas` native package. OCR uses bundled English data.
Allow two minutes for this route at the reverse proxy; measure memory with
large sample resumes before enabling in production.

`POST /api/careers/parse-resume` accepts `multipart/form-data`
with exactly one `resume` file (PDF, DOCX, JPEG or PNG; maximum 5 MiB). It
returns suggested application fields in `data`, with `meta.ocrUsed`,
`meta.warnings`, and `meta.missingFields`. Unknown scalar fields are `null`.
Applicants should review suggestions before submitting the existing job form.
Parsing creates no application record and sends only extracted text to OpenAI.
The parsed `data` contains `fullName`, `phoneNo`, `emailId`,
`educationDetails: [{ institutionName, degree, areaOfStudy, completionYear }]` (newest year first),
`workExperience: { relevantWorkExp, currentCompany, currentJobTitle, positions }`, and
`skillsAndLanguages`. The submit endpoint uses different legacy field names,
so the form must map reviewed suggestions into its submit payload.
For resumes with dated roles, `currentCompany` and `currentJobTitle` contain the
most recent listed role. `positions` contains every listed role, newest first,
as `{ company, jobTitle, startDate, endDate }`. `relevantWorkExp` can be calculated
from non-overlapping listed date ranges. Future dates are preserved and flagged in `meta.warnings`
for applicant review. Education titles are returned as printed beneath their
institutions, even if the source uses an unusual label.
If a listed job is absent from the model response, the parser reviews the work
section once more. It then recovers roles from readable source text when possible
and adds a warning; unresolved omissions appear in `meta.missingFields`.

```bash
curl -F "resume=@resume.pdf" https://your-cms.example/api/careers/parse-resume
```

Run OCR smoke tests: `node --test scripts/resume-extract.test.mjs`.

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
