# Form rate limits

Submission limits use atomic Redis counters shared by every CMS process. A process restart does not reset the quota. Redis persistence and eviction policy still determine whether counters survive Redis restarts or memory pressure.

## Limits and response contract

| Setting | Default | Purpose |
| --- | --- | --- |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Shared Redis connection used by forms and resume parsing |
| `FORM_SUBMISSION_RATE_LIMIT_MAX` | `5` | Attempts per IP per form in one window |
| `FORM_SUBMISSION_RATE_LIMIT_TOTAL_MAX` | `20` | Attempts per IP across submission routes in one window |
| `FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS` | `3600000` | Fixed window, starting with the first attempt |
| `FORM_SUBMISSION_RATE_LIMIT_REDIS_PREFIX` | `sunnydiamond:form-rate-limit:v1` | Environment-specific counter namespace |

All numeric settings must be positive safe integers. Invalid values prevent startup. Every replica of an environment must use the same Redis database, namespace and limits. Use different namespaces for staging and production.

The aggregate middleware runs before body parsing for these POST routes, including requests with invalid form tags or payloads:

- `/api/generic-submissions/submit`
- `/api/bespoke-submissions/submit`
- `/api/submissions-job-openings/submit`
- `/api/product-submissions/submit`

The middleware honors a custom `api.rest.prefix`. A successful aggregate admission consumes one of the 20 attempts even if subsequent validation, authentication, per-form admission or processing fails. Counters are independent; consuming aggregate quota does not guarantee admission by a form's five-attempt quota. Denied counters retain their original expiry.

Generic and product submissions use the published form's stored `formTag` for their quotas, normalized for whitespace and case. Caller aliases that match the same database record therefore share a quota. Unknown form tags consume aggregate admission only, without allocating a per-form key. Basic input validation and published-form lookup precede the per-form check; failed requests always consume aggregate admission when admitted by that first check. Bespoke submissions share one form quota per IP. Career submissions share one form quota per IP across email addresses and job IDs.

Appointment rescheduling, cancellation and piece addition also use Redis; their existing per-IP, per-action, per-document quotas remain separate from the new submission aggregate. Resume parsing retains its own Redis namespace and admission middleware, and continues using the existing maximum/window settings. It is excluded from the submission aggregate so resume autofill does not consume application submission quota.

Quota exhaustion returns HTTP `429` with `Retry-After` in seconds, rounded up from Redis TTL. Redis connection/command failures return HTTP `503` with `Retry-After: 5`. Failed admission does not save records or send mail. There is no in-memory fallback. The frontend should preserve entered data, honor the delay, and avoid immediate automatic retries.

## Route compatibility

Generated REST `create` routes for generic and bespoke submissions are disabled. Clients must use `/submit`; otherwise they could bypass controller limits and validation. Career and product native create routes were already disabled. This does not remove Content Manager creation or editing in the Strapi admin.

No schema/data migration, media reattachment or CAPTCHA setup is needed.

## Deployment checks

1. Verify Redis is available from every CMS replica before deploying. Configure persistence and an eviction policy suitable for security counters; eviction can restore an allowance early. Deploy the settings above consistently.
2. Verify the website sends the real shopper IP with the shared forwarding secret. nginx must overwrite `X-Real-IP`, and direct public access to the CMS port must be blocked. These are existing deployment assumptions; CMS code cannot prove them.
3. In staging, submit through the website and verify attempt six for one IP/form returns 429. Another form has its own five-attempt quota until the aggregate reaches 20. Use non-production recipients and avoid real customer data.
4. Verify the website handles 503 without clearing the form. Existing clients using native generic/bespoke create must move to `/submit` before deployment.
5. Monitor 429/503 rates by route, Redis latency/errors, and legitimate-user completion. The stable error log is `Form submission Redis rate limiter unavailable.` It excludes credentials, IPs and payloads.

The shared connection is closed by the existing Strapi destroy hook. Normal application restarts retain Redis counters. Rollback to the previous application version restores the old weaker memory limits; keep edge rate limits during rollback. Do not flush Redis to resolve an outage or roll back a release. New form keys expire automatically.

## Verification

`npm run test:forms` checks identity rotation, configuration, middleware admission, controller denial and route exclusions, plus existing IP and resume failure tests.

`npm run test:forms:redis` requires Redis on `127.0.0.1:6379`. It uses random short-lived test namespaces and removes only its own keys. It verifies concurrent admission across separate clients, reconnect persistence, email/form rotation, expiry and independent form/IP windows. It never loads production `.env` values.

Also run `npx strapi ts:generate-types`, `npx tsc --noEmit`, and `npm run build` for release validation.
