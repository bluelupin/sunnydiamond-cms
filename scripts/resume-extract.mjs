import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import yauzl from 'yauzl';

const require = createRequire(import.meta.url);
const { imageSize } = require('image-size');
const english = require('@tesseract.js-data/eng');
const MAX_PIXELS = 12_000_000;
const MAX_TEXT = 50_000;
let ocrWorker;

function fail(code) { throw new Error(code); }

async function recognize(buffer) {
  if (!ocrWorker) {
    ocrWorker = await createWorker('eng', 1, {
      langPath: english.langPath,
      gzip: true,
      cacheMethod: 'none',
    });
  }
  return (await ocrWorker.recognize(buffer)).data.text;
}

export function restoreHeaderName(fullText, headerText) {
  const firstLine = headerText.split(/\r?\n/).map(line => line.trim()).find(Boolean);
  if (!firstLine || !/^[A-Z][A-Z'.-]+(?:\s+[A-Z][A-Z'.-]+){1,4}$/.test(firstLine)) return fullText;
  if (/^(?:CURRICULUM VITAE|WORK EXPERIENCE|PROFESSIONAL SUMMARY|PERSONAL DETAILS|CONTACT DETAILS)$/i.test(firstLine)) return fullText;
  return fullText.toLowerCase().includes(firstLine.toLowerCase()) ? fullText : `${firstLine}\n${fullText}`;
}

async function recognizeImage(buffer, size) {
  let text = await recognize(buffer);
  const image = await loadImage(buffer);
  const headerHeight = Math.min(Math.ceil(size.height * 0.2), 500);
  const canvas = createCanvas(size.width, headerHeight);
  canvas.getContext('2d').drawImage(image, 0, 0, size.width, headerHeight, 0, 0, size.width, headerHeight);
  await ocrWorker.setParameters({ tessedit_pageseg_mode: '6' });
  const headerText = (await ocrWorker.recognize(canvas.toBuffer('image/png'))).data.text;
  text = restoreHeaderName(text, headerText);
  return text;
}

function checkText(text) {
  if (text.length > MAX_TEXT) fail('TOO_MUCH_TEXT');
  return text.trim();
}

export function normalizeExtractedText(text) {
  // Repair tracking inserted by PDF fonts only for known dates/headings. Never
  // collapse arbitrary spaced capitals: they can be names or qualifications.
  const words = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December', 'Present', 'Current',
    'Employment History', 'Work Experience', 'Education', 'Skills', 'Languages',
  ];
  let result = text.normalize('NFKC');
  for (const word of words) {
    const pattern = word.replace(/ /g, '').split('').join('[ \\t]*');
    result = result.replace(new RegExp(`\\b${pattern}\\b`, 'gi'), word);
  }
  return result.replace(/\b([12])[ \t]+([09])[ \t]+(\d)[ \t]+(\d)\b/g, '$1$2$3$4')
    .replace(/[ \t]+/g, ' ').trim();
}

export function layoutText(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str?.trim() || !item.transform) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let row = rows.find(candidate => Math.abs(candidate.y - y) <= 1.5);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, end: x + (item.width ?? 0), text: item.str });
  }
  rows.sort((a, b) => b.y - a.y);
  const renderRow = row => {
    row.parts.sort((a, b) => a.x - b.x);
    let line = '';
    let previousEnd = null;
    for (const part of row.parts) {
      if (previousEnd !== null && part.x - previousEnd > 1.5 && !/\s$/.test(line) && !/^\s/.test(part.text)) {
        line += ' ';
      }
      line += part.text;
      previousEnd = Math.max(previousEnd ?? part.end, part.end);
    }
    return normalizeExtractedText(line);
  };
  const readColumns = (region, depth = 0) => {
    if (depth >= 2 || region.length < 6) return region.map(renderRow).join('\n');
    // A repeated vertical gutter distinguishes a sidebar from ordinary word
    // spacing. Crossing rows remain full-width separators (headers/footers).
    const candidates = [...new Set(region.flatMap(row => row.parts.map(part => Math.round(part.x))))];
    let best;
    for (const x of candidates) {
      const left = region.filter(row => row.parts.some(part => part.end <= x - 12));
      const right = region.filter(row => row.parts.some(part => part.x >= x));
      const crossing = region.filter(row => row.parts.some(part => part.x < x && part.end > x - 12));
      const starts = region.filter(row => row.parts.some(part => Math.abs(part.x - x) < 2));
      if (left.length < 3 || right.length < 3 || starts.length < 3 || crossing.length > region.length * 0.2) continue;
      const rightText = right.map(row => renderRow({ parts: row.parts.filter(part => part.x >= x) }));
      // Right-aligned dates belong to the job/education row, not a new column.
      if (rightText.filter(text => /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?\d{4}\b|^\d{1,2}[/.]\d{4}\b/i.test(text)).length > right.length * 0.5) continue;
      const overlap = left.filter(row => right.includes(row)).length;
      const score = Math.min(left.length, right.length) + overlap - crossing.length * 2;
      if (!best || score > best.score) best = { x, score };
    }
    if (!best) return region.map(renderRow).join('\n');
    const output = [];
    let band = [];
    const flush = () => {
      if (!band.length) return;
      for (const isLeft of [true, false]) {
        const column = band.map(row => ({ y: row.y, parts: row.parts.filter(part => isLeft ? part.x < best.x : part.x >= best.x) }))
          .filter(row => row.parts.length);
        if (column.length) output.push(readColumns(column, depth + 1));
      }
      band = [];
    };
    for (const row of region) {
      if (row.parts.some(part => part.x < best.x && part.end > best.x - 12)) {
        flush();
        output.push(renderRow(row));
      } else band.push(row);
    }
    flush();
    return output.join('\n');
  };
  return readColumns(rows);
}

async function pdfText(buffer) {
  const loading = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
  });
  let document;
  try {
    document = await loading.promise;
    if (document.numPages > 5) fail('TOO_MANY_PAGES');
    const parts = [];
    let ocrUsed = false;
    for (let i = 1; i <= document.numPages; i += 1) {
      const page = await document.getPage(i);
      const content = await page.getTextContent();
      let text = layoutText(content.items);
      if (text.replace(/\s/g, '').length < 100) {
        const viewport = page.getViewport({ scale: 1.5 });
        if (viewport.width * viewport.height > MAX_PIXELS) fail('TOO_MANY_PIXELS');
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
        text = normalizeExtractedText(await recognize(canvas.toBuffer('image/png')));
        ocrUsed = true;
      }
      parts.push(text);
      checkText(parts.join('\n'));
      page.cleanup();
    }
    return { text: checkText(parts.join('\n')), ocrUsed };
  } finally {
    await loading.destroy();
  }
}

function inspectDocx(path) {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      let count = 0;
      let expanded = 0;
      let hasDocument = false;
      zip.on('entry', (entry) => {
        count += 1;
        expanded += entry.uncompressedSize;
        if (entry.fileName === 'word/document.xml') hasDocument = true;
        if (count > 1_000 || expanded > 50 * 1024 * 1024) {
          zip.close();
          reject(new Error('DOCX_LIMIT'));
          return;
        }
        zip.readEntry();
      });
      zip.on('end', () => hasDocument ? resolve() : reject(new Error('INVALID_DOCX')));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

async function extract({ path, kind }) {
  const buffer = await readFile(path);
  if (buffer.length > 5 * 1024 * 1024) fail('TOO_LARGE');
  if (kind === 'pdf') {
    if (buffer.subarray(0, 5).toString() !== '%PDF-') fail('INVALID_FILE');
    return pdfText(buffer);
  }
  if (kind === 'docx') {
    if (buffer.subarray(0, 2).toString() !== 'PK') fail('INVALID_FILE');
    await inspectDocx(path);
    const result = await mammoth.extractRawText({ path });
    return { text: checkText(normalizeExtractedText(result.value)), ocrUsed: false };
  }
  if (kind === 'png' || kind === 'jpeg') {
    const size = imageSize(buffer);
    if (size.type !== (kind === 'jpeg' ? 'jpg' : kind) || !size.width || !size.height || size.width * size.height > MAX_PIXELS) {
      fail('INVALID_IMAGE');
    }
    return { text: checkText(await recognizeImage(buffer, size)), ocrUsed: true };
  }
  fail('INVALID_FILE');
}

process.once('message', async (request) => {
  try {
    const result = await extract(request);
    process.send?.({ ok: true, result });
  } catch (error) {
    const known = new Set(['TOO_LARGE', 'TOO_MANY_PAGES', 'TOO_MANY_PIXELS', 'TOO_MUCH_TEXT', 'DOCX_LIMIT']);
    process.send?.({ ok: false, code: known.has(error?.message) ? error.message : 'UNREADABLE' });
  } finally {
    await ocrWorker?.terminate();
    process.disconnect();
  }
});
