const { askAzureOpenAi } = require("./azureOpenAiService");
const { selectChunks, asksForCompleteDocument } = require("./evidenceContentService");
const { SEARCHABLE_MIME } = require("./evidenceTextExtraction");
const semanticIndex = require("../repositories/assistantSemanticIndexRepository");
const { embedTexts, embeddingConfiguration } = require("./azureEmbeddingService");

const indexProjectFile = async (user, projectId, file, { embed = embedTexts, index = semanticIndex } = {}) => {
  if (!embeddingConfiguration()) {
    const error = new Error("La búsqueda semántica no está habilitada."); error.status = 503; throw error;
  }
  if (!SEARCHABLE_MIME.has(file?.file?.mime) || !Array.isArray(file.chunks) || !file.chunks.length) {
    const error = new Error("Este archivo no tiene texto legible para indexar."); error.status = 409; throw error;
  }
  const indexed = await index.status(user, projectId);
  if (indexed.get(file.id) === file.chunks.length) return { chunks: file.chunks.length, alreadyIndexed: true,
    usage: null };
  const result = await embed(file.chunks.map((chunk) => chunk.content));
  await index.replace(user, projectId, file.id, result.vectors);
  return { chunks: file.chunks.length, alreadyIndexed: false, usage: result.usage };
};

// The caller has already checked ownership of the project and every file.
// Only a small, question-related sample reaches Azure; the full library does not.
const askProjectKnowledge = async (files, projectId, question,
  { ask = askAzureOpenAi, user = null, embed = embedTexts, index = semanticIndex } = {}) => {
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
  const lexical = selectChunks(allChunks, question);
  let semantic = [];
  let semanticIndexedFiles = 0;
  let semanticUnavailable = false;
  if (user && embeddingConfiguration()) {
    try {
      const indexed = await index.status(user, projectId);
      semanticIndexedFiles = readable.filter((file) => indexed.get(file.id) === file.chunks.length).length;
      if (semanticIndexedFiles) {
        const { vectors } = await embed([question]);
        const candidates = await index.search(user, projectId, vectors[0]);
        const catalog = new Map(allChunks.map((chunk) =>
          [`${chunk.attachmentId}:${chunk.chunkIndex}`, chunk]));
        semantic = candidates.filter((row) => Number(row.score) >= 0.45 &&
          indexed.get(row.attachmentId) === readable.find((file) => file.id === row.attachmentId)?.chunks.length)
          .map((row) => catalog.get(`${row.attachmentId}:${row.chunkIndex}`)).filter(Boolean);
      }
    } catch { semanticUnavailable = true; }
  }
  const selected = [...new Map([...lexical.slice(0, 3), ...semantic, ...lexical]
    .map((chunk) => [`${chunk.attachmentId}:${chunk.chunkIndex}`, chunk])).values()].slice(0, 5);
  const coverage = { ...baseCoverage, includedChunks: selected.length,
    partial: selected.length < allChunks.length || files.some((file) => file.truncated || !file.chunks?.length),
    semanticIndexedFiles, semanticUnavailable,
    retrieval: semantic.length ? "lexical+semantic" : "lexical" };
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

module.exports = { askProjectKnowledge, indexProjectFile };
