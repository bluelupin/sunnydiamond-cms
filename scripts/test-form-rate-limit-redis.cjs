// Local Redis integration only. Every key uses a random test namespace with expiry.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createClient } = require('redis');
const { loadTs } = require('./resume-test-helpers.cjs');
const shared = loadTs('src/utils/resume-parser-rate-limit.ts');
const { checkFormSubmissionRateLimit: check } = loadTs('src/utils/form-submission-rate-limit.ts', {
  './resume-parser-rate-limit': shared,
});
const prefix = `sunnydiamond:test:forms:${randomUUID()}`;
const keys = new Set();
const clients = [];
const names = ['REDIS_URL', 'FORM_SUBMISSION_RATE_LIMIT_REDIS_PREFIX', 'FORM_SUBMISSION_RATE_LIMIT_MAX',
  'FORM_SUBMISSION_RATE_LIMIT_TOTAL_MAX', 'FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS'];
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
const config = { prefix, max: 5, windowMs: 10000 };
function track(parts) { keys.add(shared.resumeRateLimitKey(parts, prefix)); return parts; }

before(async () => {
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.FORM_SUBMISSION_RATE_LIMIT_REDIS_PREFIX = prefix;
  process.env.FORM_SUBMISSION_RATE_LIMIT_MAX = '5';
  process.env.FORM_SUBMISSION_RATE_LIMIT_TOTAL_MAX = '20';
  process.env.FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS = '10000';
  for (let i = 0; i < 2; i++) {
    const client = createClient({ url: process.env.REDIS_URL, RESP: 2,
      socket: { connectTimeout: 2000, reconnectStrategy: false } });
    client.on('error', () => {}); clients.push(client); await client.connect();
  }
});
after(async () => {
  shared.closeResumeRateLimitRedis();
  if (clients[0]?.isReady && keys.size) await clients[0].del([...keys]);
  for (const client of clients) if (client.isOpen) client.destroy();
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test('concurrent workers admit exactly five; denies preserve TTL and provide Retry-After', async () => {
  const parts = track(['generic', '192.0.2.10', 'contact']);
  const results = await Promise.all(Array.from({ length: 40 }, (_, index) =>
    shared.checkSharedRateLimit(parts, config, clients[index % 2])));
  assert.equal(results.filter(result => result.allowed).length, 5);
  const key = shared.resumeRateLimitKey(parts, prefix);
  const ttl = await clients[0].pTTL(key);
  const denied = await shared.checkSharedRateLimit(parts, config, clients[1]);
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterSeconds > 0 && denied.retryAfterSeconds <= 10);
  assert.ok(await clients[0].pTTL(key) <= ttl);
  assert.equal(await clients[0].get(key), '5');
});

test('career email rotation and process reconnect do not reset quota', async () => {
  track(['job-opening', '192.0.2.11']);
  for (let i = 0; i < 5; i++) assert.equal((await check(['job-opening', '192.0.2.11', `${i}@example.test`])).allowed, true);
  shared.closeResumeRateLimitRedis();
  assert.equal((await check(['job-opening', '192.0.2.11', 'fresh@example.test'])).allowed, false);
});

test('rotating form tags cannot bypass the aggregate admission ceiling', async () => {
  const total = track(['submission-total', '192.0.2.12']);
  for (let i = 0; i < 20; i++) {
    assert.equal((await check(total)).allowed, true);
    assert.equal((await check(track(['generic', '192.0.2.12', `random-${i}`]))).allowed, true);
  }
  assert.equal((await check(total)).allowed, false);
});

test('per-form and per-IP quotas are independent, and windows expire', async () => {
  for (const parts of [['generic', '192.0.2.10', 'support'], ['generic', '192.0.2.20', 'contact']]) {
    assert.equal((await shared.checkSharedRateLimit(track(parts), config, clients[0])).allowed, true);
  }
  const parts = track(['bespoke', '192.0.2.30']);
  const short = { ...config, windowMs: 120, max: 1 };
  assert.equal((await shared.checkSharedRateLimit(parts, short, clients[0])).allowed, true);
  assert.equal((await shared.checkSharedRateLimit(parts, short, clients[1])).allowed, false);
  await delay(180);
  assert.equal((await shared.checkSharedRateLimit(parts, short, clients[1])).allowed, true);
});
