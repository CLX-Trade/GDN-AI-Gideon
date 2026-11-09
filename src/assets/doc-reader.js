// Turns a user's file into text and/or page images, in the browser. This is what lets
// a whole pack through a 4.5 MB request limit, and it means the original files are
// never uploaded anywhere. Scanned PDF pages become compact images; everything with a
// text layer becomes plain text, which is far cheaper to analyse as well.
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_IMAGE_BYTES_PER_DOC = 3.1 * 1024 * 1024; // base64 grows this by a third
const MAX_PDF_PAGES = 150;
const MIN_PAGE_TEXT = 40;

export const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt,.csv,.md,.eml,.html,.htm,.xml,.json';

export class ReadError extends Error {}

function ext(name) {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export async function readDocument(file, onProgress = () => {}) {
  if (file.size > MAX_FILE_BYTES) throw new ReadError('This file is over 40 MB. Please split it.');
  if (file.size === 0) throw new ReadError('This file is empty.');
  const type = ext(file.name);
  let result;
  if (type === 'pdf' || file.type === 'application/pdf') result = await readPdf(file, onProgress);
  else if (['png', 'jpg', 'jpeg', 'webp'].includes(type) || file.type.startsWith('image/')) result = await readImage(file);
  else if (type === 'docx') result = { text: await readDocx(file), images: [], pages: null, notes: [] };
  else if (type === 'xlsx') result = { text: await readXlsx(file), images: [], pages: null, notes: [] };
  else if (['txt', 'csv', 'md', 'eml', 'xml', 'json'].includes(type) || file.type.startsWith('text/')) result = { text: await file.text(), images: [], pages: null, notes: [] };
  else if (['html', 'htm'].includes(type)) result = { text: htmlToText(await file.text()), images: [], pages: null, notes: [] };
  else throw new ReadError(`Gideon cannot read .${type || 'this file type'} yet. Try PDF, Word, Excel, an image or text.`);
  if (!result.text.trim() && !result.images.length) throw new ReadError('No readable content was found in this file.');
  return { name: file.name, size: file.size, ...result };
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body ? doc.body.innerText || doc.body.textContent || '' : '';
}

let pdfjs = null;
async function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('/vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
  }
  return pdfjs;
}

// Rebuild reading order from positioned text so that tables stay on one line each.
function pageText(content) {
  const lines = [];
  let current = [];
  let lastY = null;
  const items = content.items.filter((i) => typeof i.str === 'string');
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 3) {
      lines.push(current.join(' '));
      current = [];
    }
    if (item.str.trim()) current.push(item.str.trim());
    lastY = y;
  }
  if (current.length) lines.push(current.join(' '));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the page'))), 'image/jpeg', quality);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function renderPage(page, maxSide, quality) {
  const unit = page.getViewport({ scale: 1 });
  const scale = Math.min(maxSide / Math.max(unit.width, unit.height), 2.2);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  // The 'print' intent avoids requestAnimationFrame, which never fires in a background
  // tab: a person who switches away while a scan is reading must not stall the check.
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise;
  const blob = await canvasToJpeg(canvas, quality);
  canvas.width = 0;
  return blob;
}

async function readPdf(file, onProgress) {
  const lib = await loadPdfJs();
  const task = lib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new ReadError('This PDF is password protected. Remove the password and try again.');
    throw new ReadError('This PDF could not be opened. It may be damaged.');
  }

  const total = pdf.numPages;
  const notes = [];
  if (total > MAX_PDF_PAGES) notes.push(`Only the first ${MAX_PDF_PAGES} of ${total} pages were read.`);
  const limit = Math.min(total, MAX_PDF_PAGES);

  const chunks = [];
  const scannedPages = [];
  for (let n = 1; n <= limit; n++) {
    const page = await pdf.getPage(n);
    const text = pageText(await page.getTextContent());
    if (text.length < MIN_PAGE_TEXT) scannedPages.push(n);
    if (text) chunks.push(`--- Page ${n} ---\n${text}`);
    page.cleanup();
    onProgress(`Reading page ${n} of ${limit}`);
  }

  // Scanned pages go as images. Quality drops as needed to stay inside the budget,
  // and if pages still cannot fit the user is told plainly, never silently cut off.
  const images = [];
  let used = 0;
  const skipped = [];
  for (const n of scannedPages) {
    onProgress(`Scanning page ${n}`);
    const page = await pdf.getPage(n);
    let blob = await renderPage(page, 1700, 0.72);
    if (blob.size > 420 * 1024) blob = await renderPage(page, 1300, 0.58);
    if (used + blob.size > MAX_IMAGE_BYTES_PER_DOC) {
      blob = await renderPage(page, 1000, 0.5);
      if (used + blob.size > MAX_IMAGE_BYTES_PER_DOC) { skipped.push(n); continue; }
    }
    used += blob.size;
    images.push({ media_type: 'image/jpeg', data: await blobToBase64(blob) });
    page.cleanup();
  }
  if (skipped.length) notes.push(`${skipped.length} scanned page${skipped.length === 1 ? ' was' : 's were'} too large to include (page ${skipped.join(', ')}). Split this PDF to read them.`);
  if (scannedPages.length) notes.push(`${scannedPages.length - skipped.length} scanned page${scannedPages.length - skipped.length === 1 ? '' : 's'} read as image${scannedPages.length - skipped.length === 1 ? '' : 's'}.`);
  await task.destroy();
  return { text: chunks.join('\n\n'), images, pages: total, notes };
}

async function readImage(file) {
  const bitmap = await createImageBitmap(file).catch(() => { throw new ReadError('This image could not be opened.'); });
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob = await canvasToJpeg(canvas, 0.8);
  if (blob.size > MAX_IMAGE_BYTES_PER_DOC) blob = await canvasToJpeg(canvas, 0.55);
  return { text: '', images: [{ media_type: 'image/jpeg', data: await blobToBase64(blob) }], pages: 1, notes: [] };
}

// A small zip reader, enough for Office files. DecompressionStream is built in to
// every current browser, so Word and Excel need no extra library.
async function unzip(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ReadError('This Office file could not be opened. It may be damaged or protected.');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLen));
    entries.set(name, { method, compressed, local });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return {
    has: (name) => entries.has(name),
    names: () => [...entries.keys()],
    async text(name) {
      const e = entries.get(name);
      if (!e) return '';
      const nameLen = view.getUint16(e.local + 26, true);
      const extraLen = view.getUint16(e.local + 28, true);
      const start = e.local + 30 + nameLen + extraLen;
      const data = new Uint8Array(buffer, start, e.compressed);
      if (e.method === 0) return decoder.decode(data);
      if (e.method !== 8) throw new ReadError('This Office file uses an unsupported format.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    },
  };
}

const parseXml = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

async function readDocx(file) {
  const zip = await unzip(file);
  const xml = await zip.text('word/document.xml');
  if (!xml) throw new ReadError('This Word file has no readable text.');
  const lines = [];
  const walk = (node) => {
    for (const child of node.children) {
      const tag = child.localName;
      if (tag === 'p') {
        lines.push([...child.getElementsByTagName('w:t')].map((t) => t.textContent).join(''));
      } else if (tag === 'tr') {
        const cells = [...child.children].filter((c) => c.localName === 'tc')
          .map((c) => [...c.getElementsByTagName('w:t')].map((t) => t.textContent).join(''));
        lines.push(cells.join(' | '));
      } else {
        walk(child);
      }
    }
  };
  walk(parseXml(xml).documentElement);
  return lines.filter((l) => l.trim()).join('\n');
}

async function readXlsx(file) {
  const zip = await unzip(file);
  const shared = [];
  if (zip.has('xl/sharedStrings.xml')) {
    const doc = parseXml(await zip.text('xl/sharedStrings.xml'));
    for (const si of doc.getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  }
  const sheets = zip.names().filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  const out = [];
  for (const [index, name] of sheets.entries()) {
    const doc = parseXml(await zip.text(name));
    out.push(`--- Sheet ${index + 1} ---`);
    for (const row of doc.getElementsByTagName('row')) {
      const cells = [...row.getElementsByTagName('c')].map((c) => {
        const v = c.getElementsByTagName('v')[0];
        const inline = c.getElementsByTagName('t')[0];
        if (c.getAttribute('t') === 's' && v) return shared[Number(v.textContent)] ?? '';
        return (v && v.textContent) || (inline && inline.textContent) || '';
      });
      if (cells.some((x) => x !== '')) out.push(cells.join(' | '));
    }
  }
  return out.join('\n');
}

// Formats a document for a chat message, as text plus any page images.
export function documentBlocks(doc) {
  const blocks = doc.images.map((image) => ({ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } }));
  const body = doc.text || '(the content of this document is in the page images)';
  blocks.push({ type: 'text', text: `<document name="${doc.name.replace(/"/g, "'")}">\n${body}\n</document>` });
  return blocks;
}
