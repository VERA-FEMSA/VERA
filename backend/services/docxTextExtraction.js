const yauzl = require("yauzl");
const { SaxesParser } = require("saxes");

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MAX_ENTRIES = 200;
const MAX_XML_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 40_000;

const documentXml = async (bytes) => {
  const zip = await yauzl.fromBufferPromise(bytes, { validateEntrySizes: true, strictFileNames: true });
  try {
    if (zip.entryCount > MAX_ENTRIES) throw new Error("El DOCX contiene demasiadas partes.");
    let xml = null;
    for await (const entry of zip.eachEntry()) {
      if (entry.fileName !== "word/document.xml") continue;
      if (xml !== null) throw new Error("El DOCX contiene documentos duplicados.");
      if (entry.uncompressedSize > MAX_XML_BYTES) throw new Error("El texto del DOCX supera el límite permitido.");
      const stream = await zip.openReadStreamPromise(entry);
      const chunks = [];
      let size = 0;
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > MAX_XML_BYTES) {
          stream.destroy();
          throw new Error("El texto del DOCX supera el límite permitido.");
        }
        chunks.push(chunk);
      }
      xml = Buffer.concat(chunks);
    }
    if (xml === null) throw new Error("El DOCX no contiene un documento de Word.");
    return new TextDecoder("utf-8", { fatal: true }).decode(xml);
  } finally {
    zip.close();
  }
};

const paragraphsFromXml = (xml) => {
  if (/<!DOCTYPE/iu.test(xml)) throw new Error("El DOCX no admite declaraciones DTD.");
  const parser = new SaxesParser({ xmlns: true });
  const pages = [];
  let paragraph = "";
  let total = 0;
  let deleted = 0;
  let inText = false;
  let truncated = false;
  const append = (value) => {
    if (deleted || !value) return;
    const remaining = MAX_TEXT_CHARS - total;
    if (value.length > remaining) truncated = true;
    if (remaining > 0) {
      const selected = value.slice(0, remaining);
      paragraph += selected;
      total += selected.length;
    }
  };
  parser.on("opentag", (node) => {
    if (node.uri !== WORD_NS) return;
    if (node.local === "del") deleted += 1;
    else if (node.local === "t") inText = true;
    else if ((node.local === "tab" || node.local === "br") && !deleted) append(" ");
  });
  parser.on("text", (value) => { if (inText) append(value); });
  parser.on("closetag", (node) => {
    if (node.uri !== WORD_NS) return;
    if (node.local === "t") inText = false;
    else if (node.local === "del") deleted -= 1;
    else if (node.local === "p") {
      if (paragraph.trim()) pages.push({ pageNumber: null, text: paragraph });
      paragraph = "";
    }
  });
  parser.write(xml).close();
  if (paragraph.trim()) pages.push({ pageNumber: null, text: paragraph });
  return { pages, truncated };
};

const extractDocxParagraphs = async (bytes) => paragraphsFromXml(await documentXml(bytes));

module.exports = { extractDocxParagraphs, paragraphsFromXml };
