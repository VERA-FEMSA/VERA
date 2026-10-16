const evidenceStorage = require("./evidenceStorage");
const evidenceTextIndex = require("../repositories/evidenceTextIndex");
const { extractEvidenceText, SEARCHABLE_MIME } = require("./evidenceTextExtraction");
const { askAzureOpenAi } = require("./azureOpenAiService");

const STOP_WORDS = new Set(["que", "cual", "como", "para", "este", "esta", "documento", "archivo", "evidencia",
  "sobre", "dice", "menciona", "dame", "del", "los", "las", "una", "uno", "resumen", "resume"]);
const normalized = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const termsFor = (question) => [...new Set((normalized(question).match(/[\p{L}\p{N}]{3,}/gu) || [])
  .filter((term) => !STOP_WORDS.has(term)))];

const selectChunks = (chunks, question) => {
  const terms = termsFor(question);
  const summary = /resum|sintetiz|panorama/i.test(normalized(question));
  return chunks.map((chunk) => ({ chunk, score: terms.reduce((sum, term) =>
    sum + (normalized(chunk.content).includes(term) ? 1 : 0), 0) }))
    .filter((item) => item.score > 0 || (summary && terms.length === 0))
    .sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)
    .slice(0, 5).map((item) => item.chunk);
};

const indexFile = async (evidence, bytes) => {
  const extracted = await extractEvidenceText(bytes, evidence.file.mime);
  if (extracted.chunks.length) await evidenceTextIndex.replace(evidence.id, extracted.chunks);
  return { status: extracted.status, chunks: extracted.chunks.length, truncated: extracted.truncated };
};

const askEvidenceContent = async (evidence, question, role, { ask = askAzureOpenAi } = {}) => {
  if (!evidence.file || !SEARCHABLE_MIME.has(evidence.file.mime)) {
    const error = new Error("Solo se puede consultar el texto de archivos PDF o TXT privados.");
    error.status = 415;
    throw error;
  }
  let chunks = await evidenceTextIndex.get(evidence.id);
  if (!chunks.length) {
    const bytes = await evidenceStorage.downloadBytes(evidence.file);
    try { await indexFile(evidence, bytes); }
    catch (error) {
      if (error.status) throw error;
      const invalid = new Error("No se pudo extraer texto de este archivo.");
      invalid.status = 422;
      throw invalid;
    }
    chunks = await evidenceTextIndex.get(evidence.id);
  }
  const asOf = new Date().toISOString();
  if (!chunks.length) return { answer: "No se encontró texto legible en este archivo; puede ser un PDF escaneado.",
    mode: "no-text", citations: [], coverage: { indexedChunks: 0, includedChunks: 0, partial: false }, asOf, usage: null };

  const selected = selectChunks(chunks, question);
  const coverage = { indexedChunks: chunks.length, includedChunks: selected.length,
    partial: selected.length < chunks.length };
  if (!selected.length) return { answer: "No encontré fragmentos del archivo relacionados con esa pregunta.",
    mode: "no-match", citations: [], coverage, asOf, usage: null };

  const citations = selected.map((item) => ({
    sourceId: `evidence:${evidence.id}:chunk:${item.chunkIndex}`,
    evidenceId: evidence.id, title: evidence.title, pageNumber: item.pageNumber,
    excerpt: item.content, path: `/evidencias#evidence-${encodeURIComponent(evidence.id)}`
  }));
  const context = {
    role, scope: "Solo fragmentos de un archivo privado cuya entidad vinculada es visible para el usuario",
    counts: { indexedChunks: chunks.length },
    selection: { evidence: { visible: chunks.length, included: selected.length } },
    sources: citations.map(({ sourceId, title, pageNumber }) => ({ sourceId, type: "Fragmento de evidencia",
      title, pageNumber })),
    records: { evidence: selected.map((item) => ({ sourceId: `evidence:${evidence.id}:chunk:${item.chunkIndex}`,
      pageNumber: item.pageNumber, text: item.content })) }
  };
  const result = await ask({ question, context });
  const cited = result.sourceIds.map((id) => citations.find((item) => item.sourceId === id)).filter(Boolean);
  if (!cited.length) return { answer: "No puedo respaldar una respuesta con los fragmentos encontrados.",
    mode: "uncited", citations: [], coverage, asOf, usage: result.usage || null };
  return { answer: result.answer, mode: "generated", citations: cited, coverage, asOf, usage: result.usage || null };
};

module.exports = { askEvidenceContent, indexFile, selectChunks };
