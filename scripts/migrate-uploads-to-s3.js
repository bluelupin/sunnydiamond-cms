'use strict';

/**
 * One-time migration: move provider:'local' media (public/uploads) to S3 through the
 * active aws-s3 upload provider, rewriting files.url/formats to CloudFront URLs.
 *
 * Usage (repo root): PORT=1338 NODE_ENV=production node scripts/migrate-uploads-to-s3.js [--dry-run] [--limit N]
 *
 * Idempotent — only touches provider:'local' rows; rerun-safe. A row is updated only
 * after every binary (original + format variants) uploaded. Rows with binaries missing
 * on disk are skipped and reported. Local files are kept on disk as rollback insurance.
 */

const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx > -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

async function main() {
  const { createStrapi } = require('@strapi/strapi');
  const appDir = path.resolve(__dirname, '..');
  const app = await createStrapi({ appDir, distDir: path.join(appDir, 'dist') }).load();

  try {
    const uploadConfig = app.config.get('plugin::upload');
    if (!uploadConfig || uploadConfig.provider !== 'aws-s3') {
      throw new Error(
        `Active upload provider is "${uploadConfig && uploadConfig.provider}" — expected "aws-s3". Aborting.`
      );
    }
    const provider = app.plugin('upload').provider;
    if (!provider || typeof provider.upload !== 'function') {
      throw new Error('Upload provider instance not available.');
    }

    const uploadsDir = path.join(appDir, 'public', 'uploads');
    const rows = await app.db.query('plugin::upload.file').findMany({
      where: { provider: 'local' },
      orderBy: { id: 'asc' },
    });

    const toProcess = Number.isFinite(LIMIT) ? rows.slice(0, LIMIT) : rows;
    console.log(`${rows.length} local file(s) found; processing ${toProcess.length}${DRY ? ' [dry-run]' : ''}`);

    let migrated = 0;
    let skipped = 0;

    for (const row of toProcess) {
      const assets = [{ kind: 'original', hash: row.hash, ext: row.ext, mime: row.mime }];
      for (const [key, f] of Object.entries(row.formats || {})) {
        assets.push({ kind: key, hash: f.hash, ext: f.ext, mime: f.mime });
      }

      const missing = assets.filter((a) => !fs.existsSync(path.join(uploadsDir, `${a.hash}${a.ext}`)));
      if (missing.length) {
        console.log(`SKIP id=${row.id} ${row.name} — missing on disk: ${missing.map((m) => m.hash + m.ext).join(', ')}`);
        skipped++;
        continue;
      }

      if (DRY) {
        console.log(`DRY id=${row.id} ${row.name} — would upload ${assets.length} object(s)`);
        migrated++;
        continue;
      }

      const urls = {};
      for (const a of assets) {
        const fileData = {
          hash: a.hash,
          ext: a.ext,
          mime: a.mime,
          buffer: fs.readFileSync(path.join(uploadsDir, `${a.hash}${a.ext}`)),
        };
        await provider.upload(fileData);
        if (!fileData.url || !fileData.url.startsWith('http')) {
          throw new Error(`Provider returned unexpected url "${fileData.url}" for ${a.hash}${a.ext}`);
        }
        urls[a.kind] = fileData.url;
      }

      const newFormats = row.formats
        ? Object.fromEntries(Object.entries(row.formats).map(([k, f]) => [k, { ...f, url: urls[k] }]))
        : row.formats;

      await app.db.query('plugin::upload.file').update({
        where: { id: row.id },
        data: { url: urls.original, formats: newFormats, provider: 'aws-s3' },
      });
      migrated++;
      console.log(`OK id=${row.id} ${row.name} → ${urls.original}`);
    }

    console.log(`done: migrated=${migrated} skipped=${skipped} total_local=${rows.length}${DRY ? ' [dry-run — no writes]' : ''}`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error('MIGRATION FAILED:', err.message);
  process.exit(1);
});
