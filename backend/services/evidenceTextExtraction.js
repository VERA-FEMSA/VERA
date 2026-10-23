const { MAX_BYTES } = require("./evidenceStorage");
const { parse } = require("csv-parse/sync");
const { extractDocxParagraphs } = require("./docxTextExtraction");

const MAX_PAGES = 30;
const MAX_TEXT_CHARS = 40_000;
const CHUNK_CHARS = 800;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SEARCHABLE_MIME = new Set(["text/plain", "application/pdf", "text/csv", DOCX_MIME]);
const MAX_CSV_ROWS = 1000;
const MAX_CSV_COLUMNS = 50;

const clean = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const makeChunks = (pages) => {
  const chunks = [];
  let remaining = MAX_TEXT_CHARS;
  let truncated = false;
  for (const { pageNumber, text } of pages) {
    if (remaining <= 0) { truncated = true; break; }
    const normalized = clean(text);
    if (normalized.length > remaining) truncated = true;
    const selected = normalized.slice(0, remaining);
    remaining -= selected.length;
    for (let offset = 0; offset < selected.length; offset += CHUNK_CHARS) {
      const content = selected.slice(offset, offset + CHUNK_CHARS).trim();
      if (content) chunks.push({ chunkIndex: chunks.length, pageNumber, content });
    }
  }
  return { chunks, truncated };
};

const makePdfChunks = (pages, totalPages) => {
  const result = makeChunks(pages);
  return { ...result, truncated: result.truncated || pages.length < totalPages,
    status: result.chunks.length ? "ready" : "no-text" };
};

const extractEvidenceText = async (bytes, mime) => {
  if (!Buffer.isBuffer(bytes)) {
    throw new TypeError("El archivo debe ser un Buffer binario.");
  }
  const data = Buffer.from(bytes);
  if (data.length === 0 || data.length > MAX_BYTES) {
    throw new Error("Archivo fuera del límite de 3 MB.");
  }
  if (!SEARCHABLE_MIME.has(mime)) return { chunks: [], truncated: false, status: "unsupported" };
  if (mime === "text/plain") {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(data);
    const result = makeChunks([{ pageNumber: null, text: decoded }]);
    return { ...result, status: result.chunks.length ? "ready" : "no-text" };
  }
  if (mime === "text/csv") {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(data);
    const rows = parse(decoded, { bom: true, skip_empty_lines: true, to: MAX_CSV_ROWS + 2,
      max_record_size: 16_384 });
    if (!rows.length) return { chunks: [], truncated: false, status: "no-text" };
    const headers = rows[0];
    if (!headers.length || headers.length > MAX_CSV_COLUMNS ||
        rows.some((row) => row.length !== headers.length)) {
      throw new Error("El CSV debe tener encabezados y el mismo número de columnas en cada fila.");
    }
    const selected = rows.slice(1, MAX_CSV_ROWS + 1);
    const pages = selected.map((row, index) => ({ pageNumber: null,
      text: `Fila ${index + 2}: ${row.map((value, column) => `${clean(headers[column]) || `Columna ${column + 1}`}: ${clean(value)}`).join("; ")}` }));
    const result = makeChunks(pages);
    return { ...result, truncated: result.truncated || rows.length > MAX_CSV_ROWS + 1,
      status: result.chunks.length ? "ready" : "no-text" };
  }
  if (mime === DOCX_MIME) {
    const extracted = await extractDocxParagraphs(data);
    const result = makeChunks(extracted.pages);
    return { ...result, truncated: result.truncated || extracted.truncated,
      status: result.chunks.length ? "ready" : "no-text" };
  }
  // PDF.js needs these globals even when only extracting text. Importing the
  // canvas package directly also makes Vercel trace its native Linux binary.
  const { DOMMatrix, Path2D } = require("@napi-rs/canvas");
  globalThis.DOMMatrix ||= DOMMatrix;
  globalThis.Path2D ||= Path2D;
  const { getDocument } = require("pdfjs-dist/legacy/build/pdf.mjs");
  // Vercel traces the reader but not pdfjs-dist/package.json; do not resolve
  // that auxiliary path just to pass standardFontDataUrl.
  const task = getDocument({ data: new Uint8Array(data), isEvalSupported: false,
    disableFontFace: true, useSystemFonts: false });
  try {
    const document = await task.promise;
    const pages = [];
    let length = 0;
    const limit = Math.min(document.numPages, MAX_PAGES);
    for (let pageNumber = 1; pageNumber <= limit && length < MAX_TEXT_CHARS; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.filter((item) => typeof item.str === "string")
        .map((item) => item.str).join(" ");
      pages.push({ pageNumber, text });
      length += clean(text).length;
      page.cleanup();
    }
    return makePdfChunks(pages, document.numPages);
  } finally {
    await task.destroy();
  }
};

module.exports = { MAX_PAGES, MAX_TEXT_CHARS, MAX_CSV_ROWS, SEARCHABLE_MIME, extractEvidenceText, makeChunks, makePdfChunks };
