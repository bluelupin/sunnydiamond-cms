const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadController(strapi) {
  const filename = path.resolve(__dirname, '../src/api/homepage/controllers/homepage.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '@strapi/strapi') return {
      factories: { createCoreController: (_uid, factory) => factory({ strapi }) },
    };
    if (name.endsWith('/request-locale')) return { requestLocale: ctx => ctx.query.locale };
    if (name.endsWith('/populate')) {
      const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/populate.ts'), 'utf8');
      const populateModule = { exports: {} };
      new Function('exports', ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText)(populateModule.exports);
      return populateModule.exports;
    }
    return require(name);
  }, module, module.exports);
  return module.exports.default;
}

test('homepage shell requests navigation cards with images and CTAs and sanitizes the response', async () => {
  const card = { title: 'Featured jewellery', isActive: true,
    image: { desktopImage: { url: '/desktop.jpg' }, mobileImage: { url: '/mobile.jpg' } },
    cta: { label: 'Explore', url: '/jewellery', targetType: 'internal', openInNewTab: false } };
  const globalConfig = { headerNavigationLinks: [{ label: 'Jewellery', cards: [card] }] };
  const homepage = { hero: null };
  const auth = { credentials: { id: 1 } };
  const sanitized = [];
  const strapi = {
    documents(uid) {
      return { async findFirst(query) {
        assert.equal(query.status, 'published');
        assert.equal(query.locale, 'en');
        if (uid === 'api::global-config.global-config') {
          const cards = query.populate.headerNavigationLinks.populate.cards;
          assert.equal(cards.populate.image.populate.desktopImage, true);
          assert.equal(cards.populate.image.populate.mobileImage, true);
          assert.deepEqual(cards.populate.cta.fields, ['label', 'url', 'targetType', 'openInNewTab']);
          return globalConfig;
        }
        return homepage;
      } };
    },
    contentType: uid => ({ uid }),
    contentAPI: { sanitize: { async output(data, model, options) {
      assert.equal(options.auth, auth);
      sanitized.push(model.uid);
      return { ...data, sanitized: true };
    } } },
  };
  const result = await loadController(strapi).shell({ query: { locale: 'en' }, state: { auth } });
  assert.deepEqual(result.data.global.headerNavigationLinks[0].cards, [card]);
  assert.equal(result.data.global.sanitized, true);
  assert.equal(result.data.homepage.sanitized, true);
  assert.deepEqual(sanitized, ['api::global-config.global-config', 'api::homepage.homepage']);
});
