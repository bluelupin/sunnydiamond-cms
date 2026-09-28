const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

function loadTs(filename, overrides = {}) {
  filename = path.resolve(filename);
  const mod = { exports: {} };
  const nativeRequire = createRequire(filename);
  const localRequire = name => Object.hasOwn(overrides, name) ? overrides[name] : name.startsWith('.')
    ? loadTs(path.resolve(path.dirname(filename), `${name}.ts`), overrides) : nativeRequire(name);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
  return mod.exports;
}

// Small standards-compliant fixture writer: real PDF text, selectable columns,
// multiple pages and optional scanned JPEG. No production or personal data.
function makePdf(pages) {
  const objects = [];
  const add = content => { objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content)); return objects.length; };
  const stream = (data, dictionary = '') => Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`), data, Buffer.from('\nendstream'),
  ]);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  for (const page of pages) {
    let image;
    let content;
    if (page.jpeg) {
      image = add(stream(page.jpeg, `/Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`));
      content = Buffer.from('q 612 0 0 792 0 0 cm /Im0 Do Q');
    } else {
      content = Buffer.from(page.map(({ text, x = 40, y, size = 11 }) =>
        `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${text.replace(/[\\()]/g, '\\$&')}) Tj ET`).join('\n'));
    }
    const contents = add(stream(content));
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> ${image ? `/XObject << /Im0 ${image} 0 R >>` : ''} >> /Contents ${contents} 0 R >>`));
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  const chunks = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')]);
    chunks.push(chunk); length += chunk.length;
  });
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

module.exports = { loadTs, makePdf };
