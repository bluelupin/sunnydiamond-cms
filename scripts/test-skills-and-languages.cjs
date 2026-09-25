const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function controller() {
  const filename = path.resolve(__dirname, '../src/api/skill-and-language/controllers/skill-and-language.ts');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(() => ({
    factories: {
      createCoreController: (uid, factory) => Object.setPrototypeOf(factory(), {
        async find(ctx) { return ctx.query; },
      }),
    },
  }), module, module.exports);
  return module.exports.default;
}

test('search adds a trimmed, case-insensitive substring filter and retains pagination', async () => {
  const query = await controller().find({ query: {
    search: ' Java ', pagination: { page: 2, pageSize: 10 }, sort: 'label:asc',
  } });
  assert.deepEqual(query.filters, { $and: [{ label: { $containsi: 'Java' } }] });
  assert.deepEqual(query.pagination, { page: 2, pageSize: 10 });
  assert.equal(query.sort, 'label:asc');
  assert.equal(Object.hasOwn(query, 'search'), false);
});

test('search combines with existing type filters', async () => {
  const filters = { type: { $eq: 'Skill' } };
  const query = await controller().find({ query: { search: 'java', filters } });
  assert.deepEqual(query.filters, { $and: [filters, { label: { $containsi: 'java' } }] });
});

test('missing or blank search preserves normal listing filters', async () => {
  for (const search of [undefined, '', '   ']) {
    const filters = { type: { $eq: 'Language' } };
    const query = await controller().find({ query: { search, filters } });
    assert.deepEqual(query, { filters });
  }
});

test('invalid search values return a bad request', async () => {
  for (const search of [['Java'], { $eq: 'Java' }, null, 123]) {
    const result = await controller().find({
      query: { search }, badRequest: message => ({ status: 400, message }),
    });
    assert.deepEqual(result, { status: 400, message: 'search must be a string' });
  }
});
