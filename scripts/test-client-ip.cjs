const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/utils/form-submission-rate-limit.ts'), loaded = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, loaded, loaded.exports);
const { clientIp } = loaded.exports;
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
