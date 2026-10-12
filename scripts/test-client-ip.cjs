const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./resume-test-helpers.cjs');
const { clientIp } = loadTs('src/utils/form-submission-rate-limit.ts');
const ctx = headers => ({ ip: '127.0.0.1', get: name => headers[name] ?? '' });

test('a forwarded shopper IP counts only with the shared secret', () => {
  process.env.CMS_FORWARDED_IP_SECRET = 's3cret';
  const forwarded = { 'x-sunny-client-ip': '203.0.113.9', 'x-real-ip': '198.51.100.1' };
  assert.equal(clientIp(ctx({ ...forwarded, 'x-sunny-forwarded-secret': 's3cret' })), '203.0.113.9');
  assert.equal(clientIp(ctx({ ...forwarded, 'x-sunny-forwarded-secret': 'wrong' })), '198.51.100.1');
  assert.equal(clientIp(ctx({ 'x-sunny-client-ip': 'not-an-ip', 'x-sunny-forwarded-secret': 's3cret' })), '127.0.0.1');
  delete process.env.CMS_FORWARDED_IP_SECRET;
  assert.equal(clientIp(ctx({ ...forwarded, 'x-sunny-forwarded-secret': '' })), '198.51.100.1');
  assert.equal(clientIp(ctx({})), '127.0.0.1');
});
