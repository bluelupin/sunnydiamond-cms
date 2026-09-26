const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, stubs = {}) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (!name.startsWith('.')) return require(name);
    return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), stubs);
  }, module, module.exports);
  return module.exports;
}

const { careerOpeningSlug, registerCareerOpeningSlug } = load('src/utils/career-opening-slug.ts');
const UID = 'api::career-opening.career-opening';
const opening = { jobID: 'SD001', title: 'Assistant Showroom Manager', department: 'Sales', location: 'Chennai' };

test('Content Manager Regenerate uses current form values and stays stable on repeated clicks', async () => {
  const extend = load('src/extensions/content-manager/strapi-server.ts').default;
  const service = extend({ services: { uid: () => ({ generateUIDField: async () => 'career-opening' }) } })
    .services.uid({});
  const params = { contentTypeUID: UID, field: 'slug', data: { ...opening, slug: 'career-opening' } };
  assert.equal(await service.generateUIDField(params), 'sd001-assistant-showroom-manager-sales-chennai');
  params.data.slug = await service.generateUIDField(params);
  assert.equal(await service.generateUIDField(params), params.data.slug);
  params.data.location = 'Mumbai';
  assert.equal(await service.generateUIDField(params), 'sd001-assistant-showroom-manager-sales-mumbai');
});

test('Content Manager retains the original generator and service context for other UID fields', async () => {
  const extend = load('src/extensions/content-manager/strapi-server.ts').default;
  const service = extend({ services: { uid: () => ({
    marker: 'original',
    async generateUIDField(params) { return this.marker + ':' + params.field; },
  }) } }).services.uid({});
  assert.equal(await service.generateUIDField({ contentTypeUID: 'api::blog-post.blog-post', field: 'slug' }), 'original:slug');
  assert.equal(await service.generateUIDField({ contentTypeUID: UID, field: 'anotherField' }), 'original:anotherField');
});

function harness(current = opening) {
  let middleware;
  const queries = [];
  const documents = () => ({ findOne: async query => { queries.push(query); return current; } });
  documents.use = fn => { middleware = fn; };
  registerCareerOpeningSlug({ documents });
  return { queries, run: async (action, data, uid = UID) => {
    const context = { uid, action, params: { documentId: 'opening-1', locale: 'en', data } };
    let calls = 0;
    await middleware(context, async () => { calls++; });
    assert.equal(calls, 1);
    return context.params.data;
  } };
}

test('generates the requested slug and normalizes punctuation and whitespace', () => {
  assert.equal(careerOpeningSlug(opening), 'sd001-assistant-showroom-manager-sales-chennai');
  assert.equal(careerOpeningSlug({ ...opening, title: ' Assistant / Showroom Manager ', department: null }),
    'sd001-assistant-showroom-manager-chennai');
});

test('create generates a slug without user input and overrides manual slugs', async () => {
  const h = harness();
  for (const extra of [{}, { slug: 'custom-value' }]) {
    const result = await h.run('create', { ...opening, ...extra });
    assert.equal(result.slug, 'sd001-assistant-showroom-manager-sales-chennai');
  }
  assert.equal(h.queries.length, 0);
});

test('partial updates use stored fields from the same locale', async () => {
  const h = harness();
  const result = await h.run('update', { location: 'New Delhi' });
  assert.equal(result.slug, 'sd001-assistant-showroom-manager-sales-new-delhi');
  assert.equal(h.queries[0].locale, 'en');
  assert.equal(h.queries[0].status, 'draft');
});

test('every source field regenerates the slug and clearing optional fields removes the segment', async () => {
  for (const field of ['jobID', 'title', 'department', 'location']) {
    const result = await harness().run('update', { [field]: 'Changed' });
    assert.equal(result.slug, careerOpeningSlug({ ...opening, [field]: 'Changed' }));
  }
  const result = await harness().run('update', { department: null, location: '' });
  assert.equal(result.slug, 'sd001-assistant-showroom-manager');
});

test('unrelated saves also regenerate legacy slugs, while other types and actions pass through', async () => {
  assert.equal((await harness().run('update', { summary: 'Updated' })).slug,
    'sd001-assistant-showroom-manager-sales-chennai');
  for (const [action, uid] of [['publish', UID], ['update', 'api::blog-post.blog-post']]) {
    const h = harness();
    const data = { slug: 'unchanged' };
    assert.equal((await h.run(action, data, uid)).slug, 'unchanged');
    assert.equal(h.queries.length, 0);
  }
});
