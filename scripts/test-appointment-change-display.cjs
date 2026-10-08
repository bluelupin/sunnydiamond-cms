const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { parseDocument } = require('htmlparser2');
const { selectAll } = require('css-select');
const { decodeHTML } = require('entities');

function renderLog(snapshot) {
  const values = { previousData: { ...snapshot, workflowStatus: 'Scheduled' }, newData: snapshot };
  const module = { exports: {} };
  const filename = path.resolve(__dirname, '../src/admin/components/AppointmentDetails.tsx');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const element = tag => ({ children }) => React.createElement(tag, null, children);
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '@strapi/strapi/admin') return {
      useField: name => ({ value: values[name] }), useForm: (_, select) => select({ values }),
    };
    if (name === '@strapi/design-system') return {
      Box: element('div'), Field: { Root: element('section'), Label: element('label') }, Typography: element('span'),
    };
    return require(name);
  }, module, module.exports);
  return renderToStaticMarkup(React.createElement(React.Fragment, null,
    ...['previousData', 'newData'].map(name => React.createElement(module.exports.AppointmentDetails, { name, key: name }))));
}

test('productless store-visit logs hide only the relation widget, preserving the log page', () => {
  for (const workflowStatus of ['Scheduled', 'Cancelled']) {
    const html = renderLog({ formTag: 'store-visit', workflowStatus, requestedDate: '2099-10-12',
      selectedTimeSlot: '10:00 AM', productName: null, productId: null });
    assert.match(html, /Previous appointment/);
    assert.match(html, /Updated appointment/);
    assert.match(html, /10:00 AM/);
    if (workflowStatus === 'Cancelled') assert.match(html, /Cancelled/);
    const css = decodeHTML(html.match(/<style>([\s\S]*?)<\/style>/)[1]).replace(/\/\*[\s\S]*?\*\//g, '');
    const selector = css.slice(0, css.indexOf('{')).trim();
    // The page's first child contains the entire form, including the relation.
    // Only the widget has the relation control AND a direct sibling list.
    const dom = parseDocument(`<div id="page"><div id="form"><div id="details">${html}</div>
      <div id="relation"><div><div><label>Affected products</label><input name="affectedSubmissions"></div></div>
      <div><div><ol><li>Appointment submission</li></ol></div></div></div></div></div>`);
    assert.deepEqual(selectAll(selector, dom).map(node => node.attribs.id), ['relation']);
  }
});

test('actual products retain the native relation, including historical numeric product IDs', () => {
  for (const product of [{ productName: 'Ring' }, { productId: '123' }, { productId: 123 }]) {
    assert.doesNotMatch(renderLog({ formTag: 'store-visit', ...product }), /<style>/);
  }
  assert.doesNotMatch(renderLog({ formTag: 'product-video-call' }), /<style>/);
});
