const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, stubs = {}) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'),
      path.resolve(path.dirname(filename), name + '.ts')), stubs) : require(name);
  }, module, module.exports);
  return module.exports;
}
const { productVariantDetails } = load('src/utils/product-variant-details.ts');
test('variant input supports old clients and rejects malformed or excessive values', () => {
  assert.deepEqual(productVariantDetails({}).data, {});
  assert.deepEqual(productVariantDetails({ productSku: ' RING-RG ', metalColour: ' rose-gold ', metalPurity: ' 18K ' }).data,
    { productSku: 'RING-RG', metalColour: 'rose-gold', metalPurity: '18K' });
  for (const data of [{ productSku: {} }, { metalColour: 42 }, { metalPurity: '18K\n' },
    { productSku: 'a'.repeat(65) }, { metalColour: 'a'.repeat(101) }]) {
    assert.ok(productVariantDetails(data).error);
  }
});

test('adding different variants of one parent persists each piece and deduplicates the same variant', async () => {
  const appointment = { documentId: 'booking', productId: 'RING', productSku: 'RING-YG',
    formTag: 'store-visit', workflowStatus: 'New', addedPieces: [], requestedDate: '2099-12-01', selectedTimeSlot: '11:00 AM' };
  const notifications = [];
  const strapi = {
    db: { metadata: { get: () => ({ tableName: 'products' }) }, transaction: async run => run({ trx: {}, onCommit() {} }),
      connection: () => { const chain = { transacting: () => chain, where: () => chain, forUpdate: () => chain,
        first: async () => ({ id: 1 }) }; return chain; },
      query: () => ({ findOne: async () => appointment }) },
    documents: () => ({ update: async ({ data }) => Object.assign(appointment, data) }),
  };
  const controller = load('src/api/product-submission/controllers/product-submission.ts', {
    '@strapi/strapi': { factories: { createCoreController: (_, factory) => factory({ strapi }) } },
    '../../../utils/form-submission-rate-limit': { checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => 'test' },
    '../../../utils/appointment-piece-email': { notifyPieceAddedAfterCommit: (_, __, ___, piece) => notifications.push(piece) },
  }).default;
  const submit = variant => controller.addPiece({ params: { documentId: 'booking' }, state: { magentoCustomer: { id: 7 } },
    request: { body: { productId: 'RING', productName: 'Ring', productPath: '/rings/ring', ...variant } },
    badRequest: error => { throw new Error(error); } });
  const rose = { productSku: 'RING-RG', metalColour: 'rose-gold', metalPurity: '18K' };
  assert.equal((await submit(rose)).meta.changed, true);
  assert.equal((await submit(rose)).meta.changed, false);
  assert.equal((await submit({ productSku: 'RING-YG' })).meta.changed, false);
  assert.equal((await submit({ productSku: 'RING-WG', metalColour: 'white-gold' })).meta.changed, true);
  assert.equal(appointment.addedPieces.length, 2);
  assert.equal(appointment.addedPieces[0].metalColour, 'rose-gold');
  assert.equal(notifications.length, 2);
  await assert.rejects(submit({ metalColour: {} }), /metalColour/);
});

test('piece email renders the selected SKU and colour safely', () => {
  const { appointmentPieceAddedStaffTemplate } = load('src/emails/appointment-pieces.ts');
  const piece = { productId: 'PARENT', productSku: 'RING-RG', productName: '<Ring>', metalColour: 'rose-gold', metalPurity: '18K' };
  const email = appointmentPieceAddedStaffTemplate({ appointmentId: 'SV-1', appointmentType: 'Showroom Visit',
    requestedDate: '2099-12-01', selectedTimeSlot: '11:00 AM', pieces: [piece] }, piece);
  assert.match(email.text, /RING-RG/);
  assert.match(email.text, /rose-gold, 18K/);
  assert.match(email.html, /&lt;Ring&gt;/);
});

test('CSV export includes variant fields and added pieces', async () => {
  const service = require('../src/plugins/form-export/server/services/submission-export.js')({ strapi: {
    db: { query: () => ({ findMany: async () => [{ productId: 'RING', productSku: 'RING-RG', metalColour: 'rose-gold', metalPurity: '18K',
      addedPieces: [{ productId: 'RING', productSku: 'RING-WG' }] }] }) },
  } });
  const result = await service.exportSubmissions('product', 'https://example.com');
  assert.match(result.csv, /productSku/);
  assert.match(result.csv, /RING-RG/);
  assert.match(result.csv, /RING-WG/);
});
