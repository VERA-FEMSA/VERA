const { MAX_BYTES } = require("./evidenceStorage");
const path = require("node:path");

const MAX_PAGES = 30;
const MAX_TEXT_CHARS = 40_000;
const CHUNK_CHARS = 800;
const SEARCHABLE_MIME = new Set(["text/plain", "application/pdf"]);

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
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")),
    "standard_fonts").replace(/\\/g, "/") + "/";
  const task = getDocument({ data: new Uint8Array(data), isEvalSupported: false,
    disableFontFace: true, useSystemFonts: false, standardFontDataUrl });
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
    const result = makeChunks(pages);
    return { ...result, truncated: result.truncated || document.numPages > limit,
      status: result.chunks.length ? "ready" : "no-text" };
  } finally {
    await task.destroy();
  }
};

module.exports = { MAX_PAGES, MAX_TEXT_CHARS, SEARCHABLE_MIME, extractEvidenceText, makeChunks };
