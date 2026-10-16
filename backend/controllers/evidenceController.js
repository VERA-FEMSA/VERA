const evidenceRepository = require("../repositories/evidenceRepository");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const planningRepository = require("../repositories/planningRepository");
const userRepository = require("../repositories/userRepository");
const { logActivity } = require("../services/auditLogger");
const { ROLES } = require("../config/roles");
const evidenceStorage = require("../services/evidenceStorage");
const { indexFile, askEvidenceContent } = require("../services/evidenceContentService");
const { SEARCHABLE_MIME } = require("../services/evidenceTextExtraction");
const { readiness } = require("../services/azureOpenAiService");

const ENTITY_TYPES = ["RISK", "CONTROL", "AUDIT"];
const EVIDENCE_TYPES = ["DOCUMENT", "SCREENSHOT", "REPORT", "OTHER"];
const text = (value) => String(value ?? "").trim();

const findEntity = async (type, id) => {
  if (type === "RISK") return riskRepository.findById(id);
  if (type === "CONTROL") return controlRepository.findById(id);
  if (type === "AUDIT") return planningRepository.findById(id);
  return null;
};

const canAccessEntity = async (type, id, user) => {
  if (user.role !== ROLES.AUDITOR) return Boolean(await findEntity(type, id));
  if (type === "RISK") return (await riskRepository.findById(id))?.ownerId === user.id;
  if (type === "AUDIT") return (await planningRepository.findById(id))?.responsibleId === user.id;
  if (type === "CONTROL") {
    const control = await controlRepository.findById(id);
    if (!control) return false;
    const risks = await Promise.all(control.riskIds.map((riskId) => riskRepository.findById(riskId)));
    return risks.some((risk) => risk?.ownerId === user.id);
  }
  return false;
};

const listEvidence = async (req, res) => {
  const { entityType, entityId, search } = req.query;
  const needle = text(search).toLowerCase();
  const items = [];
  for (const item of await evidenceRepository.getAll()) {
    if (entityType && item.entityType !== entityType) continue;
    if (entityId && item.entityId !== entityId) continue;
    if (needle && !`${item.title} ${item.description} ${item.reference} ${item.entityTitle}`.toLowerCase().includes(needle)) continue;
    if (await canAccessEntity(item.entityType, item.entityId, req.user)) items.push(item);
  }
  res.json({ evidence: items });
};

const createEvidence = async (req, res) => {
  const title = text(req.body.title);
  const description = text(req.body.description);
  const evidenceType = text(req.body.evidenceType);
  const reference = text(req.body.reference);
  const entityType = text(req.body.entityType);
  const entityId = text(req.body.entityId);

  if (title.length < 3 || title.length > 120) return res.status(400).json({ message: "El nombre debe tener entre 3 y 120 caracteres." });
  if (description.length < 10 || description.length > 1000) return res.status(400).json({ message: "La descripción debe tener entre 10 y 1,000 caracteres." });
  if (!EVIDENCE_TYPES.includes(evidenceType)) return res.status(400).json({ message: "Selecciona un tipo de evidencia válido." });
  if (reference.length < 3 || reference.length > 500 || /^(javascript|data|vbscript):/i.test(reference)) {
    return res.status(400).json({ message: "Captura un enlace HTTPS o una referencia de 3 a 500 caracteres." });
  }
  if (!ENTITY_TYPES.includes(entityType) || !entityId) return res.status(400).json({ message: "Selecciona un riesgo, control o auditoría para relacionar la evidencia." });
  const entity = await findEntity(entityType, entityId);
  if (!entity) return res.status(404).json({ message: "El elemento relacionado no existe." });
  if (!await canAccessEntity(entityType, entityId, req.user)) return res.status(404).json({ message: "El elemento relacionado no existe." });

  const author = await userRepository.findById(req.user.id);
  const evidence = await evidenceRepository.create({
    title,
    description,
    evidenceType,
    reference,
    entityType,
    entityId,
    entityTitle: entity.title,
    author: { id: req.user.id, username: req.user.username, name: author?.name || req.user.username, role: req.user.role }
  });
  await logActivity({ actor: req.user, action: "EVIDENCE_REGISTERED", details: { evidenceId: evidence.id, title: evidence.title, entityType, entityId, entityTitle: entity.title } });
  res.status(201).json({ evidence });
};

const uploadEvidence = async (req, res) => {
  const title = text(req.query.title);
  const description = text(req.query.description);
  const evidenceType = text(req.query.evidenceType);
  const entityType = text(req.query.entityType);
  const entityId = text(req.query.entityId);
  const mime = text(req.headers["content-type"]).split(";")[0].toLowerCase();
  if (title.length < 3 || title.length > 120) return res.status(400).json({ message: "El nombre debe tener entre 3 y 120 caracteres." });
  if (description.length < 10 || description.length > 1000) return res.status(400).json({ message: "La descripción debe tener entre 10 y 1,000 caracteres." });
  if (!EVIDENCE_TYPES.includes(evidenceType)) return res.status(400).json({ message: "Selecciona un tipo de evidencia válido." });
  if (!ENTITY_TYPES.includes(entityType) || !entityId) return res.status(400).json({ message: "Selecciona un riesgo, control o auditoría." });
  if (!evidenceStorage.MIME_EXTENSIONS[mime]) return res.status(415).json({ message: "Tipo de archivo no permitido." });
  const entity = await findEntity(entityType, entityId);
  if (!entity || !await canAccessEntity(entityType, entityId, req.user)) {
    return res.status(404).json({ message: "El elemento relacionado no existe." });
  }
  const file = await evidenceStorage.upload({ entityType, entityId, mime, bytes: req.body });
  const author = await userRepository.findById(req.user.id);
  let evidence;
  try {
    evidence = await evidenceRepository.create({
      title, description, evidenceType,
      reference: "Archivo privado almacenado en VERA", entityType, entityId, entityTitle: entity.title,
      file, author: { id: req.user.id, username: req.user.username, name: author?.name || req.user.username, role: req.user.role }
    });
  } catch (error) {
    try { await evidenceStorage.remove(file); } catch (cleanupError) {
      console.error("[EVIDENCE_FILE_CLEANUP_FAILED]", cleanupError.message);
    }
    throw error;
  }
  await logActivity({ actor: req.user, action: "EVIDENCE_FILE_UPLOADED", details: {
    evidenceId: evidence.id, entityType, entityId, size: file.size, mime: file.mime
  } });
  let contentIndex = { status: "unsupported", chunks: 0, truncated: false };
  if (SEARCHABLE_MIME.has(file.mime)) {
    try { contentIndex = await indexFile(evidence, req.body); }
    catch { contentIndex = { status: "pending", chunks: 0, truncated: false }; }
  }
  res.status(201).json({ evidence, contentIndex });
};

const downloadEvidence = async (req, res) => {
  const evidence = await evidenceRepository.findById(req.params.id);
  if (!evidence?.file || !await canAccessEntity(evidence.entityType, evidence.entityId, req.user)) {
    return res.status(404).json({ message: "Archivo de evidencia no encontrado." });
  }
  const url = await evidenceStorage.signedDownloadUrl(evidence.file);
  res.set("Cache-Control", "no-store");
  res.json({ url, expiresIn: 60 });
};

const askEvidence = async (req, res) => {
  const startedAt = Date.now();
  const evidence = await evidenceRepository.findById(req.params.id);
  if (!evidence?.file || !await canAccessEntity(evidence.entityType, evidence.entityId, req.user)) {
    return res.status(404).json({ message: "Archivo de evidencia no encontrado." });
  }
  const question = req.body?.question;
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 500) {
    return res.status(400).json({ message: "Escribe una pregunta de 3 a 500 caracteres." });
  }
  try {
    if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
        process.env.VERA_EVIDENCE_COMMENT_STORE !== "supabase") {
      return res.status(503).json({ message: "La consulta de archivos requiere evidencias persistentes." });
    }
    if (!readiness().available) return res.status(503).json({ message: "La consulta de archivos requiere Azure OpenAI activo." });
    const result = await askEvidenceContent(evidence, question.trim(), req.user.role);
    const durationMs = Date.now() - startedAt;
    console.info(JSON.stringify({ event: "VERA_AI_EVIDENCE", status: 200, role: req.user.role,
      mode: result.mode, durationMs, promptTokens: result.usage?.prompt_tokens ?? null,
      completionTokens: result.usage?.completion_tokens ?? null }));
    return res.set("Cache-Control", "no-store").json({ ...result, durationMs,
      usage: result.usage ? { promptTokens: result.usage.prompt_tokens ?? null,
        completionTokens: result.usage.completion_tokens ?? null } : null });
  } catch (error) {
    console.warn(JSON.stringify({ event: "VERA_AI_EVIDENCE_ERROR", status: error.status || 502,
      durationMs: Date.now() - startedAt }));
    if ([415, 422, 503].includes(error.status)) return res.status(error.status).json({ message: error.message });
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({ message: "La consulta tardó demasiado. Intenta de nuevo." });
    }
    return res.status(502).json({ message: "No se pudo consultar el contenido de la evidencia." });
  }
};

module.exports = { listEvidence, createEvidence, uploadEvidence, downloadEvidence, askEvidence };
