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
  return rows.sort((a, b) => b.y - a.y).map(row => {
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
    return line.trim();
  }).join('\n');
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
        text = await recognize(canvas.toBuffer('image/png'));
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
    return { text: checkText(result.value), ocrUsed: false };
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
