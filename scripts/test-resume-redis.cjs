// Opt-in integration tests against local Redis. Touch only random test keys.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createClient } = require('redis');
const { loadTs } = require('./resume-test-helpers.cjs');
const { checkResumeParserRateLimit, resumeRateLimitKey, closeResumeRateLimitRedis } = loadTs('src/utils/resume-parser-rate-limit.ts');
const prefix = `sunnydiamond:test:resume-rate-limit:${randomUUID()}`;
const keys = new Set();
const clients = [];
const originals = Object.fromEntries(['FORM_SUBMISSION_RATE_LIMIT_MAX', 'FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS', 'REDIS_URL', 'RESUME_RATE_LIMIT_REDIS_PREFIX'].map(name => [name, process.env[name]]));
const parts = name => { const values = ['resume-parser', name]; keys.add(resumeRateLimitKey(values, prefix)); return values; };
const check = (name, client = clients[0]) => checkResumeParserRateLimit(parts(name), client, prefix);
before(async () => {
  process.env.FORM_SUBMISSION_RATE_LIMIT_MAX = '5';
  process.env.FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS = '10000';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.RESUME_RATE_LIMIT_REDIS_PREFIX = prefix;
  for (let i = 0; i < 2; i++) {
    const client = createClient({ url: process.env.REDIS_URL, RESP: 2, socket: { connectTimeout: 2000, reconnectStrategy: false } });
    client.on('error', () => {}); clients.push(client); await client.connect();
  }
});
after(async () => {
  closeResumeRateLimitRedis();
  if (clients[0]?.isReady && keys.size) await clients[0].del([...keys]);
  for (const client of clients) if (client.isOpen) client.destroy();
  for (const [name, value] of Object.entries(originals)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
test('sixth attempt blocked across independent clients; denied attempts do not extend TTL', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await check('shared', clients[i % 2])).allowed, true);
  const key = resumeRateLimitKey(parts('shared'), prefix);
  const before = await clients[0].pTTL(key);
  assert.equal((await check('shared', clients[1])).allowed, false);
  assert.ok(await clients[0].pTTL(key) <= before);
  assert.equal(await clients[0].get(key), '5');
});
test('atomic concurrent admission permits exactly five of forty requests', async () => {
  const results = await Promise.all(Array.from({ length: 40 }, (_, index) => check('race', clients[index % 2])));
  assert.equal(results.filter(result => result.allowed).length, 5);
});
test('different client identities have independent windows', async () => {
  assert.equal((await check('new-client')).allowed, true);
  assert.equal((await check('shared')).allowed, false);
});
test('expired window resets and receives a fresh TTL', async () => {
  process.env.FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS = '120';
  for (let i = 0; i < 5; i++) await check('expiry');
  assert.equal((await check('expiry')).allowed, false);
  await delay(180);
  assert.equal((await check('expiry')).allowed, true);
  assert.equal(await clients[0].get(resumeRateLimitKey(parts('expiry'), prefix)), '1');
  process.env.FORM_SUBMISSION_RATE_LIMIT_WINDOW_MS = '10000';
});
test('client shutdown/reconnect preserves the Redis counter', async () => {
  const identity = parts('restart');
  for (let i = 0; i < 5; i++) assert.equal((await checkResumeParserRateLimit(identity)).allowed, true);
  closeResumeRateLimitRedis();
  assert.equal((await checkResumeParserRateLimit(identity)).allowed, false);
  closeResumeRateLimitRedis();
});
test('orphaned key without expiration is repaired with a bounded window', async () => {
  const key = resumeRateLimitKey(parts('orphan'), prefix);
  await clients[0].set(key, '5');
  assert.equal((await check('orphan')).allowed, true);
  assert.ok(await clients[0].pTTL(key) > 0);
});
