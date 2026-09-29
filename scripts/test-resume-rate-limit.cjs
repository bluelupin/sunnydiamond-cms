const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./resume-test-helpers.cjs');
const { checkResumeParserRateLimit, resumeRateLimitKey } = loadTs('src/utils/resume-parser-rate-limit.ts');

test('counter uses a namespaced hash without exposing the IP', () => {
  const key = resumeRateLimitKey(['resume-parser', '203.0.113.1'], 'test');
  assert.match(key, /^test:[a-f0-9]{64}$/);
  assert.notEqual(resumeRateLimitKey(['a:b', 'c']), resumeRateLimitKey(['a', 'b:c']));
});
test('Redis TTL determines Retry-After, rounding up', async () => {
  assert.deepEqual(await checkResumeParserRateLimit(['test'], { eval: async () => [0, 1001] }), { allowed: false, retryAfterSeconds: 2 });
  assert.deepEqual(await checkResumeParserRateLimit(['test'], { eval: async () => [1, 500] }), { allowed: true, retryAfterSeconds: 0 });
});
test('malformed Redis replies and errors never admit a request', async () => {
  for (const value of [null, [], [2, 1000], [0, -1], [0, '1000']]) {
    await assert.rejects(checkResumeParserRateLimit(['test'], { eval: async () => value }));
  }
  await assert.rejects(checkResumeParserRateLimit(['test'], { eval: async () => { throw new Error('offline'); } }));
});
test('hung Redis command has a bounded timeout', async () => {
  await assert.rejects(checkResumeParserRateLimit(['test'], { eval: () => new Promise(() => {}) }), /timed out/);
});
const originalEnabled = process.env.RESUME_PARSER_ENABLED;
const originalKey = process.env.OPENAI_API_KEY;
process.env.RESUME_PARSER_ENABLED = 'true';
process.env.OPENAI_API_KEY = 'test-only';
after(() => {
  if (originalEnabled === undefined) delete process.env.RESUME_PARSER_ENABLED; else process.env.RESUME_PARSER_ENABLED = originalEnabled;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
});
function admission(check) {
  const removed = [];
  const errors = [];
  const factory = loadTs('src/middlewares/resume-parser-admission.ts', {
    '../utils/resume-parser-rate-limit': { checkResumeParserRateLimit: check },
    'node:fs/promises': { rm: async file => { removed.push(file); } },
  }).default;
  return { run: factory({}, { strapi: { log: { error: message => errors.push(message) } } }), removed, errors };
}
const ctx = () => ({ method: 'POST', path: '/api/careers/parse-resume', ip: '127.0.0.1',
  headers: {}, request: {}, is: () => true, get: () => '',
  set(name, value) { this.headers[name] = value; },
  throw(status, message) { throw Object.assign(new Error(message), { status }); },
});
test('429 propagates Redis TTL and skips parser', async () => {
  const middleware = admission(async parts => {
    assert.deepEqual(parts, ['resume-parser', '127.0.0.1']);
    return { allowed: false, retryAfterSeconds: 42 };
  });
  const request = ctx();
  await assert.rejects(middleware.run(request, () => assert.fail('parser ran')), error => error.status === 429);
  assert.equal(request.headers['Retry-After'], '42');
});
test('Redis outage returns 503, logs safely, and releases busy flag for recovery', async () => {
  let fail = true;
  const middleware = admission(async () => { if (fail) throw new Error('secret connection details'); return { allowed: true }; });
  const request = ctx();
  await assert.rejects(middleware.run(request, () => assert.fail('parser ran')), error => error.status === 503);
  assert.equal(request.headers['Retry-After'], '5');
  assert.deepEqual(middleware.errors, ['Resume parser Redis rate limiter unavailable.']);
  fail = false;
  let ran = false;
  await middleware.run(ctx(), async () => { ran = true; });
  assert.equal(ran, true);
});
test('busy reservation covers the asynchronous Redis check', async () => {
  let admit;
  let calls = 0;
  const middleware = admission(() => { calls++; return new Promise(resolve => { admit = resolve; }); });
  const first = middleware.run(ctx(), async () => {});
  await assert.rejects(middleware.run(ctx(), () => assert.fail('concurrent parser ran')), error => error.status === 503);
  assert.equal(calls, 1);
  admit({ allowed: true });
  await first;
});
test('parser failure cleans upload and releases busy reservation', async () => {
  const middleware = admission(async () => ({ allowed: true }));
  const request = ctx();
  await assert.rejects(middleware.run(request, async () => {
    request.request.files = { resume: { filepath: 'test-upload' } };
    throw new Error('parser failed');
  }), /parser failed/);
  assert.deepEqual(middleware.removed, ['test-upload']);
  await middleware.run(ctx(), async () => {});
});
test('other routes bypass resume Redis admission', async () => {
  const middleware = admission(() => assert.fail('Redis checked'));
  const request = ctx(); request.path = '/api/other';
  let ran = false;
  await middleware.run(request, async () => { ran = true; });
  assert.equal(ran, true);
});
