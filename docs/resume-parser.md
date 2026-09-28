# Resume autofill

`POST /api/careers/parse-resume` accepts one multipart `resume` PDF or DOCX.
File extraction and scanned-PDF OCR run locally in an isolated child process.
Only extracted text is sent to OpenAI. Uploaded files are removed by the admission
middleware after the request. There is no application response cache.

## Consistency rules

- Selectable PDF text is read by column when a repeated gutter is detected.
  Full-width rows separate column regions; right-aligned dates remain on their row.
- Known letter-spaced headings and dates are repaired locally. Arbitrary names
  and initials are preserved. Sparse PDF pages use local OCR independently.
- The default model and the `gpt-4.1-mini` alias resolve to
  `gpt-4.1-mini-2025-04-14`. Other `OPENAI_RESUME_MODEL` values remain overrides.
  Supported GPT-4 family requests use temperature zero and strict JSON schema.
- Extracted strings are checked against source text. This checks textual support,
  not whether every relationship inferred by the model is correct.
- Recognized job and education layouts supply canonical source values. Partial
  local recovery preserves other model-extracted jobs and qualifications.
- Contact formatting, job dates, duplicate jobs, skill/language deduplication,
  and result ordering are normalized locally.
- Experience is elapsed employment at month precision, using the current UTC
  month, merging overlaps and excluding future months. It does not measure job
  relevance. Missing or invalid job dates produce `null`, not a model estimate.
  Year-only ranges use January boundaries and emit an approximation warning.
- Current company/title come from the first normalized position: ongoing roles
  first, then latest end/start date. With no ongoing role this is the latest listed
  role, not confirmation that the person remains employed there.
- `meta.warnings` exposes unsupported values, ambiguous email addresses, recovered
  roles, approximate dates, future dates and invalid dates. `missingFields` exposes
  null fields. Clients should let applicants review and edit autofilled values.

The response shape is unchanged. Phone formatting and array order are now
canonical; unavailable experience can become null. No schema migration or admin
re-entry is required. Restart/redeploy the CMS to use the updated code. Rolling
back the controller, normalization helper and extraction script restores the old
behavior without a data migration.

## Verification

```sh
npm run test:resume
npm run test:resume:redis
npx tsc --noEmit
npm run build
```

Offline tests generate temporary synthetic PDFs/DOCX and exercise real local
extraction/OCR, normalization, provider failure handling and upload validation.
Layouts include single column, left/right sidebars, equal columns, three columns,
full-width headings, aligned dates, reversed drawing order, tracked dates,
multiple pages, scans and mixed text/scanned pages.

An optional live test uses the configured API key, sends synthetic extracted
text, checks expected fields and compares outputs across five layouts:

```sh
node scripts/test-resume-live.cjs --live
```

For the Sydney regression sample, append `--pdf <path-to-Sydney-PDF>` to also run
three fresh model calls and compare every returned data field. This option is
specific to the known Kristen Connelly fixture. The sample itself is not checked
into the repository. Live tests bypass HTTP admission, so they do not consume the
application's rate-limit counters. They do consume provider tokens.

These tests cover representative layouts, not every possible resume. Temperature
zero and a pinned model reduce variability but do not guarantee identical future
model output. OCR errors, unusual layouts and ambiguous relationships still need
applicant review.

## Admission and rate limits

Autofill counts live in Redis at `redis://127.0.0.1:6379` by default. Set `REDIS_URL`
to override the connection. Keys use `sunnydiamond:resume-rate-limit:v1:<hash>`;
the hash identifies the route and client IP without putting the raw IP in keys.
`RESUME_RATE_LIMIT_REDIS_PREFIX` can isolate deployments sharing a Redis instance.
The connection uses RESP2, including compatibility with the local Redis 5 server.
The default is five admitted attempts per
one-hour fixed window, starting at the first attempt. Configure with
`FORM_SUBMISSION_RATE_LIMIT_MAX` and `FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS`.
Attempts that pass admission count even if subsequent extraction/provider work
fails. An atomic Lua operation checks the count, increments admitted attempts and
sets the initial TTL. Denied attempts do not extend the window. Redis expiry clears
counts automatically; CMS restarts preserve them, and workers using the same Redis
and prefix share the quota. Durability across a Redis restart depends on Redis's
persistence configuration. Redis failures return 503 with `Retry-After: 5`, emit
`Resume parser Redis rate limiter unavailable.` in server logs, and never fall
back to independent process counters. Connection/command waits are bounded.

A separate process-local `busy` flag allows one active parser request per process.
Other submission endpoints still use their existing in-memory limiter. No limiter
stores autofill responses. The Redis integration tests touch only unique temporary
test keys and check concurrent admission, expiry, separate clients and reconnects.
