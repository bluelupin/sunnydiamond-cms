const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./resume-test-helpers.cjs');

const names = ['FORM_SUBMISSION_RATE_LIMIT_MAX', 'FORM_SUBMISSION_RATE_LIMIT_TOTAL_MAX',
  'FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS', 'FORM_SUBMISSION_RATE_LIMIT_REDIS_PREFIX'];
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
for (const name of names) delete process.env[name];
after(() => { for (const [name, value] of Object.entries(original)) {
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
} });

function limiter(check) {
  return loadTs('src/utils/form-submission-rate-limit.ts', {
    './resume-parser-rate-limit': { checkSharedRateLimit: check },
  });
}

test('career emails share an IP quota; distinct forms and IPs have distinct quotas', async () => {
  const counters = new Map();
  const calls = [];
  const { checkFormSubmissionRateLimit: check } = limiter(async (parts, config) => {
    calls.push({ parts, config });
    const key = JSON.stringify(parts);
    const count = counters.get(key) ?? 0;
    if (count >= config.max) return { allowed: false, retryAfterSeconds: 123 };
    counters.set(key, count + 1);
    return { allowed: true, retryAfterSeconds: 0 };
  });
  for (let i = 0; i < 5; i++) assert.equal((await check(['job-opening', '192.0.2.1', `${i}@example.test`])).allowed, true);
  assert.deepEqual(await check(['job-opening', '192.0.2.1', 'new@example.test']), { allowed: false, retryAfterSeconds: 123 });
  assert.equal((await check(['job-opening', '192.0.2.2'])).allowed, true);
  for (const tag of ['contact', 'support']) {
    for (let i = 0; i < 5; i++) assert.equal((await check(['generic', '192.0.2.1', tag])).allowed, true);
    assert.equal((await check(['generic', '192.0.2.1', tag])).allowed, false);
    assert.equal((await check(['generic', '192.0.2.1', ` ${tag.toUpperCase()} `])).allowed, false);
  }
  assert.equal(calls[0].config.windowMs, 3600000);
  assert.equal(calls[0].config.max, 5);
});

test('total admission uses an independent shared quota and oversized tags collapse to one key', async () => {
  const calls = [];
  const { checkFormSubmissionRateLimit: check } = limiter(async (...args) => {
    calls.push(args); return { allowed: true, retryAfterSeconds: 0 };
  });
  await check(['submission-total', '192.0.2.1', 'ignored']);
  await check(['generic', '192.0.2.1', 'a'.repeat(101)]);
  await check(['generic', '192.0.2.1', 'b'.repeat(10000)]);
  assert.deepEqual(calls[0][0], ['submission-total', '192.0.2.1']);
  assert.equal(calls[0][1].max, 20);
  assert.deepEqual(calls[1][0], calls[2][0]);
});

test('Redis failure is fail-closed with a safe log and retry delay', async () => {
  const logs = [];
  const { checkFormSubmissionRateLimit: check } = limiter(async () => { throw new Error('redis://secret@host'); });
  assert.deepEqual(await check(['bespoke', '192.0.2.1'], { error: message => logs.push(message) }),
    { allowed: false, retryAfterSeconds: 5, unavailable: true });
  assert.deepEqual(logs, ['Form submission Redis rate limiter unavailable.']);
});

test('invalid settings are rejected; defaults cannot be disabled by zero or fractions', () => {
  const { formRateLimitConfig } = limiter();
  for (const name of names.slice(0, 3)) {
    for (const value of ['0', '-1', '0.5', 'Infinity', 'NaN', '9007199254740992']) {
      process.env[name] = value;
      assert.throws(() => formRateLimitConfig(), new RegExp(name));
    }
    delete process.env[name];
  }
});

function context(path = '/api/generic-submissions/submit', method = 'POST') {
  return { path, method, ip: '192.0.2.1', get: () => '', headers: {},
    set(name, value) { this.headers[name] = value; },
    throw(status, message) { throw Object.assign(new Error(message), { status }); },
  };
}
function admission(result, prefix = '/api') {
  const calls = [];
  const factory = loadTs('src/middlewares/form-submission-admission.ts', {
    '../utils/form-submission-rate-limit': {
      clientIp: ctx => ctx.ip,
      checkFormSubmissionRateLimit: async parts => { calls.push(parts); return result; },
    },
  }).default;
  return { calls, run: factory({}, { strapi: { config: { get: () => prefix }, log: {} } }) };
}

test('all submission routes reject before body parsing, including case and trailing slash variants', async () => {
  const { run, calls } = admission({ allowed: false, retryAfterSeconds: 37 });
  for (const route of ['generic-submissions', 'bespoke-submissions', 'submissions-job-openings', 'product-submissions']) {
    for (const path of [`/api/${route}/submit`, `/API/${route.toUpperCase()}/SUBMIT/`]) {
      const ctx = context(path);
      Object.defineProperty(ctx, 'request', { get() { assert.fail('body accessed before admission'); } });
      await assert.rejects(run(ctx, () => assert.fail('body parser reached')), error => error.status === 429);
      assert.equal(ctx.headers['Retry-After'], '37');
    }
  }
  assert.ok(calls.every(parts => parts.join(':') === 'submission-total:192.0.2.1'));
});

test('admission handles custom prefix, Redis outage and unrelated routes', async () => {
  const { run, calls } = admission({ allowed: false, retryAfterSeconds: 5, unavailable: true }, '/content');
  const ctx = context('/content/generic-submissions/submit');
  await assert.rejects(run(ctx, () => assert.fail('parser reached')), error => error.status === 503);
  assert.equal(ctx.headers['Retry-After'], '5');
  for (const path of ['/api/generic-submissions/submit', '/content/careers/parse-resume', '/admin', '/content/homepage']) {
    let reached = false;
    await run(context(path), async () => { reached = true; });
    assert.equal(reached, true);
  }
  await run(context('/content/generic-submissions/submit', 'GET'), async () => {});
  assert.equal(calls.length, 1);
  let reached = false;
  await admission({ allowed: true, retryAfterSeconds: 0 }).run(context(), async () => { reached = true; });
  assert.equal(reached, true);
});

test('submission controllers await denial and never call persistence or providers', async () => {
  for (const type of ['generic-submission', 'bespoke-submission', 'submissions-job-opening', 'product-submission']) {
    for (const unavailable of [false, true]) {
      const strapi = { log: {}, documents: () => ({
        findFirst: async () => ({ formTag: 'canonical-form' }),
        create: () => assert.fail('persistence reached'),
      }), plugin: () => assert.fail('provider reached') };
      const controller = loadTs(`src/api/${type}/controllers/${type}.ts`, {
        '@strapi/strapi': { factories: { createCoreController: (_, factory) => factory({ strapi }) } },
        '../../../utils/form-submission-rate-limit': {
          clientIp: () => '192.0.2.1',
          checkFormSubmissionRateLimit: async parts => {
            if (parts[0] === 'generic' || parts[0] === 'product') assert.equal(parts[2], 'canonical-form');
            return { allowed: false, unavailable, retryAfterSeconds: unavailable ? 5 : 17 };
          },
        },
        '../../../utils/request-locale': { requestLocale: () => 'en' },
      }).default;
      const ctx = { state: {}, request: { body: {
        formTag: 'CALLER-ALIAS', fullName: 'Guest', productName: 'Visit',
        customerName: 'Guest', customerPhone: '9876543210',
      } }, headers: {},
        set(name, value) { this.headers[name] = value; },
        serviceUnavailable: () => 503, tooManyRequests: () => 429,
      };
      assert.equal(await controller.submit(ctx), unavailable ? 503 : 429, type);
      assert.equal(ctx.headers['Retry-After'], unavailable ? '5' : '17');
    }
  }
});

test('core create is excluded for every submission collection', () => {
  for (const type of ['generic-submission', 'bespoke-submission', 'submissions-job-opening', 'product-submission']) {
    const router = loadTs(`src/api/${type}/routes/${type}.ts`, {
      '@strapi/strapi': { factories: { createCoreRouter: (_, options) => options } },
    }).default;
    assert.ok(router.except.includes('create'), type);
  }
});
