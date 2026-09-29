import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, writeFile, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import JSZip from 'jszip';
import { layoutText, normalizeExtractedText } from './resume-extract.mjs';
import helpers from './resume-test-helpers.cjs';
const { makePdf } = helpers;
let directory;
before(async () => { directory = await mkdtemp(join(tmpdir(), 'resume-layout-tests-')); });
after(async () => {
  for (const name of await readdir(directory)) await unlink(join(directory, name));
  await rmdir(directory);
});

function extract(path, kind = 'pdf') {
  return new Promise((resolveResult, reject) => {
    const child = fork(resolve('scripts/resume-extract.mjs'), [], { silent: true, execArgv: ['--max-old-space-size=384'] });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Extraction timed out')); }, 60_000);
    child.once('message', message => { clearTimeout(timer); resolveResult(message); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (code) reject(new Error(`Extractor exited ${code}`)); });
    child.send({ path, kind });
  });
}
const lines = (texts, x = 40, y = 730) => texts.map((text, index) => ({ text, x, y: y - index * 22 }));
const main = ['Alex Morgan', 'Experience', 'Engineer, Acme Systems', 'January 2020 - Present', 'Built reliable applications for customers.', 'Education', 'BA in Design, Example University', 'January 2016 - December 2019'];
const sidebar = ['Contact', 'alex@example.com', '2025550123', 'Skills', 'Python', 'Adobe Premiere Pro', 'Languages', 'English'];
const item = ({ text, x, y, size = 11 }) => ({ str: text, width: text.length * size * 0.48, height: size, transform: [size, 0, 0, size, x, y] });

test('tracking repair is limited to known dates/headings, preserving initials', () => {
  assert.equal(normalizeExtractedText('F E B R U A R Y 2 0 2 1 — P R E S E N T\nE D U C A T I O N\nA B Smith'), 'February 2021 — Present\nEducation\nA B Smith');
});
const layouts = [
  { name: 'single-column', rows: [...lines(main), ...lines(sidebar, 40, 500)], ordered: ['Experience', 'Education', 'Skills'] },
  { name: 'right-sidebar', rows: [...lines(main), ...lines(sidebar, 420)], ordered: ['Experience', 'Education', 'Skills'] },
  { name: 'left-sidebar', rows: [...lines(sidebar), ...lines(main, 250)], ordered: ['Skills', 'Experience', 'Education'] },
  { name: 'equal-columns', rows: [...lines(main.map(text => text.length > 35 ? text.slice(0, 35) : text)), ...lines(sidebar, 340)], ordered: ['Experience', 'Education', 'Skills'] },
  { name: 'full-width-header', rows: [{ text: 'ALEX MORGAN - SOFTWARE ENGINEERING PROFESSIONAL', x: 40, y: 770, size: 17 }, ...lines(main), ...lines(sidebar, 420)], ordered: ['ALEX MORGAN', 'Experience', 'Education', 'Skills'] },
  { name: 'reverse-drawing-order', rows: [...lines(main), ...lines(sidebar, 420)].reverse(), ordered: ['Experience', 'Education', 'Skills'] },
  { name: 'tracked-dates', rows: lines(main.map(text => text === 'January 2020 - Present' ? 'J A N U A R Y 2 0 2 0 - P R E S E N T' : text)), ordered: ['Experience', 'January 2020 - Present', 'Education'] },
];
for (const fixture of layouts) {
  test(`real PDF extraction: ${fixture.name}`, async () => {
    const path = join(directory, `${fixture.name}.pdf`);
    await writeFile(path, makePdf([fixture.rows]));
    const result = await extract(path);
    assert.equal(result.ok, true);
    assert.equal(result.result.ocrUsed, false);
    let previous = -1;
    for (const expected of fixture.ordered) {
      const index = result.result.text.indexOf(expected);
      assert.ok(index > previous, `${expected} out of order:\n${result.result.text}`);
      previous = index;
    }
    if (fixture.name.includes('sidebar')) {
      assert.ok(result.result.text.includes('Engineer, Acme Systems\nJanuary 2020 - Present'));
      assert.ok(result.result.text.includes('Skills\nPython\nAdobe Premiere Pro\nLanguages'));
    }
  });
}
test('right-aligned date table remains row-wise', () => {
  const rows = [...lines(['Experience', 'Engineer, Acme', 'Editor, Other', 'Designer, Third', 'Education', 'Example University']),
    ...lines(['January 2024 - Present', 'January 2022 - January 2024', 'January 2020 - January 2022', 'January 2018 - January 2020'], 380, 708)];
  const text = layoutText(rows.map(item));
  assert.match(text, /Engineer, Acme January 2024 - Present\nEditor, Other January 2022/);
});
test('three columns maintain within-column sections', () => {
  const text = layoutText([...lines(['Profile', 'Designer', 'Portfolio', 'Available', 'Contact', 'Alex']),
    ...lines(['Experience', 'Acme', 'Editor', 'Education', 'College', 'Design'], 240),
    ...lines(['Skills', 'Python', 'Editing', 'Languages', 'English', 'French'], 440)].map(item));
  assert.ok(text.includes('Experience\nAcme\nEditor\nEducation\nCollege\nDesign'));
  assert.ok(text.includes('Skills\nPython\nEditing\nLanguages\nEnglish\nFrench'));
});
test('multipage PDF retains both pages', async () => {
  const path = join(directory, 'multipage.pdf');
  await writeFile(path, makePdf([lines(main), lines([...sidebar, 'Additional skills: editing, production and design.'])]));
  const result = await extract(path);
  assert.equal(result.ok, true); assert.equal(result.result.ocrUsed, false);
  assert.match(result.result.text, /Acme Systems/); assert.match(result.result.text, /Adobe Premiere Pro/);
});
test('scanned PDF uses local OCR and preserves key fields', async () => {
  const canvas = createCanvas(1224, 1584);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'black'; context.font = '30px Arial';
  [...main, ...sidebar].forEach((text, index) => context.fillText(text, 80, 100 + index * 65));
  const path = join(directory, 'scan.pdf');
  await writeFile(path, makePdf([{ jpeg: canvas.toBuffer('image/jpeg'), width: canvas.width, height: canvas.height }]));
  const result = await extract(path);
  assert.equal(result.ok, true); assert.equal(result.result.ocrUsed, true);
  assert.match(result.result.text, /Alex Morgan/i); assert.match(result.result.text, /Acme Systems/i);
  assert.match(result.result.text, /Python/i);
});
test('scanned two-column PDF retains jobs and sidebar skills', async () => {
  const canvas = createCanvas(1224, 1584);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'black'; context.font = '24px Arial';
  main.forEach((text, index) => context.fillText(text, 60, 100 + index * 65));
  sidebar.forEach((text, index) => context.fillText(text, 850, 100 + index * 65));
  const path = join(directory, 'scan-columns.pdf');
  await writeFile(path, makePdf([{ jpeg: canvas.toBuffer('image/jpeg'), width: canvas.width, height: canvas.height }]));
  const result = await extract(path);
  assert.equal(result.ok, true); assert.equal(result.result.ocrUsed, true);
  assert.match(result.result.text, /Acme Systems/i); assert.match(result.result.text, /Python/i);
  assert.match(result.result.text, /English/i);
});
test('mixed selectable-text and scanned pages use per-page OCR', async () => {
  const canvas = createCanvas(1224, 1584);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'black'; context.font = '32px Arial';
  sidebar.forEach((text, index) => context.fillText(text, 80, 100 + index * 65));
  const path = join(directory, 'mixed.pdf');
  await writeFile(path, makePdf([lines(main), { jpeg: canvas.toBuffer('image/jpeg'), width: canvas.width, height: canvas.height }]));
  const result = await extract(path);
  assert.equal(result.ok, true); assert.equal(result.result.ocrUsed, true);
  assert.match(result.result.text, /Engineer, Acme Systems/); assert.match(result.result.text, /Adobe Premiere Pro/i);
});
test('DOCX stays local and repairs tracked dates', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Alex Morgan</w:t></w:r></w:p><w:p><w:r><w:t>J A N U A R Y 2 0 2 0 - P R E S E N T</w:t></w:r></w:p></w:body></w:document>');
  const path = join(directory, 'resume.docx');
  await writeFile(path, await zip.generateAsync({ type: 'nodebuffer' }));
  const result = await extract(path, 'docx');
  assert.equal(result.ok, true); assert.equal(result.result.ocrUsed, false);
  assert.match(result.result.text, /January 2020 - Present/);
});
test('extraction repeated three times is identical', async () => {
  const path = join(directory, 'repeat.pdf');
  await writeFile(path, makePdf([[...lines(main), ...lines(sidebar, 420)].flat()]));
  const first = await extract(path);
  assert.deepEqual(await extract(path), first); assert.deepEqual(await extract(path), first);
});
for (const [name, bytes, code] of [
  ['invalid.pdf', Buffer.from('not a PDF'), 'UNREADABLE'],
  ['too-many-pages.pdf', makePdf(Array.from({ length: 6 }, () => lines(main))), 'TOO_MANY_PAGES'],
  ['too-large.pdf', Buffer.alloc(5 * 1024 * 1024 + 1), 'TOO_LARGE'],
]) {
  test(`file limits: ${name}`, async () => {
    const path = join(directory, name); await writeFile(path, bytes);
    assert.deepEqual(await extract(path), { ok: false, code });
  });
}
