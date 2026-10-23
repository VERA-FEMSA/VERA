const { askAzureOpenAi } = require("./azureOpenAiService");
const { selectChunks, asksForCompleteDocument } = require("./evidenceContentService");
const { SEARCHABLE_MIME } = require("./evidenceTextExtraction");

// The caller has already checked ownership of the project and every file.
// Only a small, question-related sample reaches Azure; the full library does not.
const askProjectKnowledge = async (files, projectId, question, { ask = askAzureOpenAi } = {}) => {
  const asOf = new Date().toISOString();
  const readable = files.filter((file) => SEARCHABLE_MIME.has(file.file.mime) &&
    Array.isArray(file.chunks) && file.chunks.length > 0);
  const allChunks = readable.flatMap((file) => file.chunks.map((chunk) => ({ ...chunk,
    attachmentId: file.id, name: file.name })));
  const baseCoverage = { filesVisible: files.length, filesIndexed: readable.length,
    indexedChunks: allChunks.length, includedChunks: 0, partial: true };
  if (!allChunks.length) return {
    answer: "No hay texto legible en esta biblioteca. Para una imagen, selecciónala individualmente; un PDF escaneado requiere OCR.",
    mode: "no-text", citations: [], references: [], coverage: baseCoverage, asOf, usage: null
  };
  if (asksForCompleteDocument(question)) return {
    answer: "No puedo afirmar totales ni describir toda la biblioteca desde fragmentos parciales. Consulta una sección concreta y verifica los originales.",
    mode: "scope-limited", citations: [], references: [], coverage: baseCoverage, asOf, usage: null
  };
  const selected = selectChunks(allChunks, question);
  const coverage = { ...baseCoverage, includedChunks: selected.length,
    partial: selected.length < allChunks.length || files.some((file) => file.truncated || !file.chunks?.length) };
  if (!selected.length) return {
    answer: "No encontré fragmentos de los archivos del proyecto relacionados con esa pregunta.",
    mode: "no-match", citations: [], references: [], coverage, asOf, usage: null
  };
  const citations = selected.map((chunk) => ({
    sourceId: `attachment:${chunk.attachmentId}:chunk:${chunk.chunkIndex}`,
    attachmentId: chunk.attachmentId, projectId, type: "Archivo del proyecto",
    title: chunk.name, pageNumber: chunk.pageNumber, excerpt: chunk.content
  }));
  const context = {
    scope: "Muestra acotada de archivos privados del proyecto visible a la cuenta y rol actuales",
    counts: { indexedChunks: allChunks.length, files: readable.length },
    selection: { visible: allChunks.length, included: selected.length, partial: coverage.partial },
    sources: citations.map(({ sourceId, title, pageNumber }) => ({ sourceId, type: "Archivo del proyecto",
      title, pageNumber })),
    records: { attachment: selected.map((chunk) => ({
      sourceId: `attachment:${chunk.attachmentId}:chunk:${chunk.chunkIndex}`,
      title: chunk.name, pageNumber: chunk.pageNumber, text: chunk.content
    })) }
  };
  const generated = await ask({ question, context });
  const cited = generated.sourceIds.map((id) => citations.find((item) => item.sourceId === id)).filter(Boolean);
  if (!cited.length) return {
    answer: "No puedo respaldar la respuesta con los fragmentos seleccionados.",
    mode: "uncited", citations: [], references: [], coverage, asOf, usage: generated.usage || null
  };
  return { answer: generated.answer, mode: "attachment-project", citations: cited,
    references: [], coverage, asOf, usage: generated.usage || null };
};

module.exports = { askProjectKnowledge };
