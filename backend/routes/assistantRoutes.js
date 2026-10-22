const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { verifyToken } = require("../middleware/authMiddleware");
const { buildAssistantContext } = require("../services/assistantContextService");
const { readiness } = require("../services/azureOpenAiService");
const { answerAssistant } = require("../services/assistantAnswerService");
const conversations = require("../repositories/assistantConversationRepository");
const projects = require("../repositories/assistantProjectRepository");
const memory = require("../repositories/assistantMemoryRepository");
const attachments = require("../repositories/assistantAttachmentRepository");
const evidenceStorage = require("../services/evidenceStorage");
const { extractEvidenceText, SEARCHABLE_MIME } = require("../services/evidenceTextExtraction");
const { askAttachment, IMAGE_MIME } = require("../services/assistantAttachmentService");
const { currentScope } = require("../services/assistantConversationScope");
const { buildAuditDossier } = require("../services/assistantDossierService");
const { searchAssistantEvidence } = require("../services/assistantEvidenceSearchService");
const { buildDecisionInsights } = require("../services/assistantInsightService");
const { AUDIT_PROPOSAL_CREATE_ROLES, ROLES } = require("../config/roles");
const { allowRoles } = require("../middleware/roleMiddleware");
const { buildProposalDraft } = require("../services/assistantProposalDraftService");
const { issueFeedbackToken, verifyFeedbackToken } = require("../services/assistantFeedbackToken");
const assistantFeedback = require("../repositories/assistantFeedbackRepository");
const userRepository = require("../repositories/userRepository");
const { randomUUID } = require("node:crypto");

const router = express.Router();
router.use(verifyToken);
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

router.get("/status", (req, res) => {
  try {
    res.json({ ...readiness(), mode: "read-only",
      ...(process.env.VERA_AI_CONVERSATIONS_ENABLED === "true" && !req.user.roleTour
        ? { conversations: true,
          ...(process.env.VERA_AI_PROJECTS_ENABLED === "true" ? { projects: true } : {}),
          ...(process.env.VERA_AI_MEMORY_ENABLED === "true" ? { memory: true } : {}),
          ...(process.env.VERA_AI_ATTACHMENTS_ENABLED === "true" ? { attachments: true } : {}) } : {}) });
  } catch {
    res.json({ available: false, reason: "invalid-configuration", mode: "read-only" });
  }
});

const conversationEnabled = (req, res, next) => {
  if (req.user.roleTour) return res.status(403).json({ message: "El recorrido de rol no incluye conversaciones privadas." });
  return process.env.VERA_AI_CONVERSATIONS_ENABLED === "true"
    ? next() : res.status(503).json({ message: "El historial privado aún no está habilitado." });
};
const projectEnabled = (req, res, next) => process.env.VERA_AI_PROJECTS_ENABLED === "true"
  ? conversationEnabled(req, res, next)
  : res.status(503).json({ message: "Los proyectos privados aún no están habilitados." });
const memoryEnabled = (req, res, next) => process.env.VERA_AI_MEMORY_ENABLED === "true"
  ? conversationEnabled(req, res, next)
  : res.status(503).json({ message: "La memoria privada aún no está habilitada." });
const attachmentEnabled = (req, res, next) => process.env.VERA_AI_ATTACHMENTS_ENABLED === "true"
  ? conversationEnabled(req, res, next)
  : res.status(503).json({ message: "Los archivos privados del chat aún no están habilitados." });
const conversationError = (res, error) => {
  if ([400, 404, 409, 415, 422, 429, 503, 504].includes(error.status)) return res.status(error.status).json({ message: error.message });
  return res.status(502).json({ message: "No se pudo consultar el historial privado." });
};
const focusFrom = (value) => {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !["audit", "risk", "control", "finding"].includes(value.type) ||
      typeof value.id !== "string" || !value.id.trim() || value.id.length > 80) {
    const error = new Error("Selecciona un expediente válido."); error.status = 400; throw error;
  }
  return { type: value.type, id: value.id };
};

const projectIdFrom = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    const error = new Error("Selecciona un proyecto válido."); error.status = 400; throw error;
  }
  return value;
};
const validUuid = (value) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

router.get("/conversations/:id/attachments", attachmentEnabled, async (req, res) => {
  try {
    if (!await conversations.get(req.user, req.params.id)) {
      return res.status(404).json({ message: "Conversación no disponible." });
    }
    return res.json({ attachments: await attachments.list(req.user, req.params.id) });
  } catch (error) { return conversationError(res, error); }
});

router.post("/conversations/:id/attachments", attachmentEnabled,
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 4, keyGenerator: (req) => String(req.user.id),
    standardHeaders: "draft-8", legacyHeaders: false }),
  express.raw({ type: () => true, limit: "2mb" }), async (req, res) => {
    const mime = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ message: "El cuerpo del archivo no es válido." });
    }
    const fileBytes = Buffer.from(req.body);
    let name;
    try { name = decodeURIComponent(String(req.headers["x-file-name"] || "")); }
    catch { return res.status(400).json({ message: "El nombre del archivo no es válido." }); }
    name = name.replace(/[\\/\x00-\x1f\x7f]/g, "").trim();
    if (!name || name.length > 120 || fileBytes.length === 0 ||
        fileBytes.length > 2 * 1024 * 1024 || !(SEARCHABLE_MIME.has(mime) || IMAGE_MIME.has(mime))) {
      return res.status(400).json({ message: "Adjunta un PDF, DOCX, TXT, CSV, PNG, JPEG o WebP de hasta 2 MB." });
    }
    try {
      if (!await conversations.get(req.user, req.params.id)) {
        return res.status(404).json({ message: "Conversación no disponible." });
      }
      if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
          process.env.VERA_EVIDENCE_COMMENT_STORE !== "supabase") {
        return res.status(503).json({ message: "Los archivos requieren almacenamiento privado persistente." });
      }
      if ((await attachments.list(req.user, req.params.id)).length >= attachments.MAX_PER_CONVERSATION ||
          await attachments.countForUser(req.user) >= attachments.MAX_PER_USER) {
        return res.status(409).json({ message: "Alcanzaste el límite de archivos del chat." });
      }
      let extracted = { chunks: [], status: "ready", truncated: false };
      if (SEARCHABLE_MIME.has(mime)) {
        try { extracted = await extractEvidenceText(fileBytes, mime); }
        catch { return res.status(422).json({ message: "No se pudo extraer texto de este archivo." }); }
      }
      const file = await evidenceStorage.upload({ entityType: "ai", entityId: req.params.id,
        mime, bytes: fileBytes });
      try {
        const saved = await attachments.create(req.user, req.params.id,
          { name, file, chunks: extracted.chunks, status: extracted.status, truncated: extracted.truncated });
        console.info(JSON.stringify({ event: "VERA_AI_ATTACHMENT", role: req.user.role,
          mime, bytes: file.size, chunks: extracted.chunks.length }));
        return res.status(201).json({ attachment: saved });
      } catch (error) {
        try { await evidenceStorage.remove(file); } catch { /* Cleanup may require operator review. */ }
        throw error;
      }
    } catch (error) { return conversationError(res, error); }
  });

router.get("/conversations/:id/attachments/:attachmentId/download", attachmentEnabled, async (req, res) => {
  try {
    if (!await conversations.get(req.user, req.params.id)) {
      return res.status(404).json({ message: "Conversación no disponible." });
    }
    const row = await attachments.get(req.user, req.params.id, req.params.attachmentId);
    if (!row) return res.status(404).json({ message: "Archivo no disponible." });
    const url = await evidenceStorage.signedDownloadUrl(row.file);
    return res.json({ url, expiresIn: 60 });
  } catch (error) { return conversationError(res, error); }
});

router.delete("/conversations/:id/attachments/:attachmentId", attachmentEnabled, async (req, res) => {
  try {
    if (!await conversations.get(req.user, req.params.id)) {
      return res.status(404).json({ message: "Conversación no disponible." });
    }
    const row = await attachments.get(req.user, req.params.id, req.params.attachmentId);
    if (!row) return res.status(404).json({ message: "Archivo no disponible." });
    await evidenceStorage.remove(row.file);
    await attachments.remove(req.user, req.params.id, row.id);
    return res.status(204).end();
  } catch (error) { return conversationError(res, error); }
});

router.get("/memories", memoryEnabled, async (req, res) => {
  try { return res.json({ memories: await memory.list(req.user) }); }
  catch (error) { return conversationError(res, error); }
});

router.post("/memories", memoryEnabled,
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, keyGenerator: (req) => String(req.user.id),
    standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
    const content = req.body?.content;
    if (typeof content !== "string" || !content.trim() || content.trim().length > 200) {
      return res.status(400).json({ message: "La nota debe tener entre 1 y 200 caracteres." });
    }
    try { return res.status(201).json({ memory: await memory.create(req.user, content.trim()) }); }
    catch (error) { return conversationError(res, error); }
  });

router.patch("/memories/:id", memoryEnabled, async (req, res) => {
  const { content, enabled, version } = req.body || {};
  if (typeof content !== "string" || !content.trim() || content.trim().length > 200 ||
      typeof enabled !== "boolean" || !Number.isInteger(version) || version < 1) {
    return res.status(400).json({ message: "La nota o la versión no son válidas." });
  }
  try {
    const updated = await memory.update(req.user, req.params.id, version,
      { content: content.trim(), enabled });
    if (!updated) return res.status(404).json({ message: "Nota no disponible." });
    return res.json({ memory: updated });
  } catch (error) { return conversationError(res, error); }
});

router.delete("/memories/:id", memoryEnabled, async (req, res) => {
  try {
    if (!await memory.remove(req.user, req.params.id)) {
      return res.status(404).json({ message: "Nota no disponible." });
    }
    return res.status(204).end();
  } catch (error) { return conversationError(res, error); }
});

router.get("/projects", projectEnabled, async (req, res) => {
  try { return res.json({ projects: await projects.list(req.user) }); }
  catch (error) { return conversationError(res, error); }
});

router.post("/projects", projectEnabled,
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, keyGenerator: (req) => String(req.user.id),
    standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
    const name = req.body?.name;
    const description = req.body?.description ?? "";
    const instructions = req.body?.instructions ?? "";
    if (typeof name !== "string" || !name.trim() || name.trim().length > 80 ||
        typeof description !== "string" || description.length > 500 ||
        typeof instructions !== "string" || instructions.length > 800) {
      return res.status(400).json({ message: "El nombre, la descripción o las instrucciones no son válidos." });
    }
    try { return res.status(201).json({ project: await projects.create(req.user, name.trim(), description.trim(), instructions.trim()) }); }
    catch (error) { return conversationError(res, error); }
  });

router.patch("/projects/:id", projectEnabled, async (req, res) => {
  const { name, description, version } = req.body || {};
  const instructions = req.body?.instructions;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80 ||
      typeof description !== "string" || description.length > 500 ||
      (instructions !== undefined && (typeof instructions !== "string" || instructions.length > 800)) ||
      !Number.isInteger(version) || version < 1) {
    return res.status(400).json({ message: "El proyecto o la versión no son válidos." });
  }
  try {
    const project = await projects.update(req.user, req.params.id, version,
      { name: name.trim(), description: description.trim(),
        ...(instructions === undefined ? {} : { instructions: instructions.trim() }) });
    if (!project) return res.status(404).json({ message: "Proyecto no disponible." });
    return res.json({ project });
  } catch (error) { return conversationError(res, error); }
});

router.delete("/projects/:id", projectEnabled, async (req, res) => {
  try {
    if (!await projects.remove(req.user, req.params.id)) {
      return res.status(404).json({ message: "Proyecto no disponible." });
    }
    await conversations.unlinkProject(req.user, req.params.id);
    return res.status(204).end();
  } catch (error) { return conversationError(res, error); }
});

router.get("/conversations", conversationEnabled, async (req, res) => {
  try { return res.json({ conversations: await conversations.list(req.user) }); }
  catch (error) { return conversationError(res, error); }
});

router.post("/conversations", conversationEnabled,
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: (req) => String(req.user.id),
    standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
    try {
      const focus = focusFrom(req.body?.focus);
      const projectId = projectIdFrom(req.body?.projectId);
      if (projectId && (process.env.VERA_AI_PROJECTS_ENABLED !== "true" ||
          !await projects.get(req.user, projectId))) {
        return res.status(404).json({ message: "Proyecto no disponible." });
      }
      const scopeHash = await currentScope(req.user, focus);
      const conversation = await conversations.create(req.user, focus, scopeHash, projectId);
      return res.status(201).json({ conversation: { ...conversation, scopeHash: undefined } });
    } catch (error) { return conversationError(res, error); }
  });

router.get("/conversations/:id", conversationEnabled, async (req, res) => {
  try {
    const conversation = await conversations.get(req.user, req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversación no disponible." });
    const scopeHash = await currentScope(req.user, conversation.focus);
    if (scopeHash !== conversation.scopeHash) return res.json({ conversation: {
      ...conversation, messages: [], scopeHash: undefined, stale: true } });
    return res.json({ conversation: { ...conversation, scopeHash: undefined, stale: false } });
  } catch (error) { return conversationError(res, error); }
});

router.patch("/conversations/:id", conversationEnabled, async (req, res) => {
  const title = req.body?.title;
  const version = req.body?.version;
  if (typeof title !== "string" || title.trim().length < 1 || title.trim().length > 80 ||
      !Number.isInteger(version) || version < 1) {
    return res.status(400).json({ message: "El nombre o la versión no son válidos." });
  }
  try {
    const conversation = await conversations.update(req.user, req.params.id, version, { title: title.trim() });
    if (!conversation) return res.status(404).json({ message: "Conversación no disponible." });
    return res.json({ conversation: { ...conversation, messages: undefined, scopeHash: undefined } });
  } catch (error) { return conversationError(res, error); }
});

router.patch("/conversations/:id/project", projectEnabled, async (req, res) => {
  if (!Number.isInteger(req.body?.version) || req.body.version < 1) {
    return res.status(400).json({ message: "La versión no es válida." });
  }
  try {
    const projectId = projectIdFrom(req.body?.projectId);
    if (projectId && !await projects.get(req.user, projectId)) {
      return res.status(404).json({ message: "Proyecto no disponible." });
    }
    const conversation = await conversations.update(req.user, req.params.id, req.body.version,
      { project_id: projectId });
    if (!conversation) return res.status(404).json({ message: "Conversación no disponible." });
    return res.json({ conversation: { ...conversation, messages: undefined, scopeHash: undefined } });
  } catch (error) { return conversationError(res, error); }
});

router.delete("/conversations/:id", conversationEnabled, async (req, res) => {
  try {
    if (!await conversations.get(req.user, req.params.id)) {
      return res.status(404).json({ message: "Conversación no disponible." });
    }
    if (process.env.VERA_AI_ATTACHMENTS_ENABLED === "true") {
      for (const row of await attachments.list(req.user, req.params.id)) {
        const stored = await attachments.get(req.user, req.params.id, row.id);
        await evidenceStorage.remove(stored.file);
        await attachments.remove(req.user, req.params.id, row.id);
      }
    }
    await conversations.remove(req.user, req.params.id);
    return res.status(204).end();
  } catch (error) { return conversationError(res, error); }
});

router.post("/conversations/:id/ask", conversationEnabled,
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: (req) => String(req.user.id),
    standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
    const question = req.body?.question;
    const withEvidence = req.body?.withEvidence === true;
    const attachmentId = req.body?.attachmentId ?? null;
    if (typeof question !== "string" || question.trim().length < 3 ||
        question.length > (withEvidence ? 500 : 800) ||
        (req.body?.withEvidence !== undefined && typeof req.body.withEvidence !== "boolean") ||
        (attachmentId !== null && (!validUuid(attachmentId) || withEvidence ||
          process.env.VERA_AI_ATTACHMENTS_ENABLED !== "true"))) {
      return res.status(400).json({ message: "Escribe una pregunta válida para esta conversación." });
    }
    const startedAt = Date.now();
    try {
      const thread = await conversations.get(req.user, req.params.id);
      if (!thread) return res.status(404).json({ message: "Conversación no disponible." });
      const scopeHash = await currentScope(req.user, thread.focus);
      if (scopeHash !== thread.scopeHash) return res.status(409).json({
        message: "Cambió el alcance de tus expedientes. Inicia una conversación nueva." });
      const history = thread.messages.slice(-6).map(({ role, text }) => ({ role, text: text.slice(0, 800) }));
      const attached = attachmentId ? await attachments.get(req.user, thread.id, attachmentId) : null;
      if (attachmentId && !attached) return res.status(404).json({ message: "Archivo no disponible." });
      const project = thread.projectId ? await projects.get(req.user, thread.projectId) : null;
      const result = attached ? await askAttachment(attached, question.trim())
        : await answerAssistant(req.user, question.trim(), history, thread.focus, withEvidence,
          project?.instructions || "");
      const currentUser = await userRepository.findById(req.user.id);
      if (currentUser?.status !== "ACTIVE" || currentUser.role !== req.user.role ||
          await currentScope(req.user, thread.focus) !== scopeHash) {
        return res.status(409).json({ message: "Cambió tu acceso. Inicia una conversación nueva." });
      }
      const durationMs = Date.now() - startedAt;
      const userMessage = { id: randomUUID(), role: "user", text: question.trim(), asOf: new Date().toISOString(),
        ...(attached ? { attachmentId: attached.id, attachmentName: attached.name } : {}) };
      const assistantMessage = { id: randomUUID(), role: "assistant", text: result.answer.slice(0, 4000),
        mode: result.mode, metric: result.metric || null, citations: (result.citations || []).slice(0, 8),
        references: (result.references || []).slice(0, 15), coverage: result.coverage || null,
        asOf: result.asOf, durationMs };
      const messages = [...thread.messages, userMessage, assistantMessage].slice(-40);
      while (Buffer.byteLength(JSON.stringify(messages), "utf8") > 140_000 && messages.length > 2) {
        messages.splice(0, 2);
      }
      const updated = await conversations.update(req.user, thread.id, thread.version, { messages });
      const channel = withEvidence ? "evidence-search" : "ask";
      const feedbackToken = issueFeedbackToken(req.user, channel, result.mode);
      console.info(JSON.stringify({ event: "VERA_AI_CONVERSATION", role: req.user.role,
        mode: result.mode, durationMs, promptTokens: result.usage?.prompt_tokens ?? null,
        completionTokens: result.usage?.completion_tokens ?? null }));
      return res.json({ conversationId: thread.id, version: updated.version, userMessage,
        message: { ...assistantMessage, feedbackToken }, usage: result.usage ? {
          promptTokens: result.usage.prompt_tokens ?? null,
          completionTokens: result.usage.completion_tokens ?? null } : null });
    } catch (error) { return conversationError(res, error); }
  });

router.get("/brief", async (req, res) => {
  try {
    if (readiness().reason === "persistent-stores-required") {
      return res.status(503).json({ message: "Las prioridades requieren almacenes persistentes en producción." });
    }
    const { brief } = await buildAssistantContext(req.user, "prioridades de mi portafolio");
    return res.json({ role: req.user.role, signals: brief });
  } catch {
    return res.status(502).json({ message: "No se pudieron consultar las prioridades." });
  }
});

router.get("/insights", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30,
  keyGenerator: (req) => String(req.user.id), standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  try {
    if (readiness().reason === "persistent-stores-required") {
      return res.status(503).json({ message: "Las prioridades requieren almacenes persistentes en producción." });
    }
    const { visibleRecords, asOf } = await buildAssistantContext(req.user, "prioridades de mi portafolio");
    return res.json(buildDecisionInsights({ visibleRecords, asOf }));
  } catch {
    return res.status(502).json({ message: "No se pudieron calcular las prioridades." });
  }
});

router.post("/draft-proposal", rateLimit({ windowMs: 15 * 60 * 1000, limit: 5,
  keyGenerator: (req) => String(req.user.id), standardHeaders: "draft-8", legacyHeaders: false }),
allowRoles(...AUDIT_PROPOSAL_CREATE_ROLES), async (req, res) => {
  const startedAt = Date.now();
  const riskId = req.body?.riskId;
  if (typeof riskId !== "string" || !riskId.trim() || riskId.length > 80) {
    return res.status(400).json({ message: "Selecciona un riesgo válido para el borrador." });
  }
  try {
    const state = readiness();
    if (state.reason === "persistent-stores-required") {
      return res.status(503).json({ message: "El borrador requiere almacenes persistentes en producción." });
    }
    const result = await buildProposalDraft(req.user, riskId, { generate: state.available });
    console.info(JSON.stringify({ event: "VERA_AI_PROPOSAL_DRAFT", status: 200, role: req.user.role,
      mode: result.mode, durationMs: Date.now() - startedAt }));
    return res.json(result);
  } catch (error) {
    if ([400, 403, 404].includes(error.status)) return res.status(error.status).json({ message: error.message });
    console.warn(JSON.stringify({ event: "VERA_AI_PROPOSAL_DRAFT_ERROR", status: 502,
      durationMs: Date.now() - startedAt }));
    return res.status(502).json({ message: "No se pudo preparar el borrador." });
  }
});

router.post("/feedback", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
  keyGenerator: (req) => String(req.user.id), standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  if (typeof req.body?.feedbackToken !== "string" || req.body.feedbackToken.length > 1000 ||
      !["helpful", "unhelpful"].includes(req.body?.rating)) {
    return res.status(400).json({ message: "La valoración no es válida." });
  }
  try {
    const { interactionId, channel, mode } = verifyFeedbackToken(req.body.feedbackToken, req.user);
    await assistantFeedback.save({ interactionId, channel, mode, rating: req.body.rating });
    console.info(JSON.stringify({ event: "VERA_AI_FEEDBACK", channel, mode, rating: req.body.rating }));
    return res.status(201).json({ recorded: true });
  } catch (error) {
    if ([400, 409, 503].includes(error.status)) return res.status(error.status).json({ message: error.message });
    return res.status(502).json({ message: "No se pudo registrar la valoración." });
  }
});

router.get("/quality", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30,
  keyGenerator: (req) => String(req.user.id), standardHeaders: "draft-8", legacyHeaders: false }),
allowRoles(ROLES.SUPER_ADMIN), async (req, res) => {
  try { return res.json(await assistantFeedback.summary()); }
  catch { return res.status(503).json({ message: "No se pudo consultar la calidad del asistente." }); }
});

router.post("/dossier/:auditId", rateLimit({ windowMs: 15 * 60 * 1000, limit: 5,
  keyGenerator: (req) => String(req.user.id), standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  const startedAt = Date.now();
  const auditId = req.params.auditId;
  if (typeof auditId !== "string" || !auditId.trim() || auditId.length > 80) {
    return res.status(400).json({ message: "Selecciona una auditoría válida." });
  }
  try {
    const state = readiness();
    if (state.reason === "persistent-stores-required") {
      return res.status(503).json({ message: "El expediente requiere almacenes persistentes en producción." });
    }
    const dossier = await buildAuditDossier(req.user, auditId, { generate: state.available });
    console.info(JSON.stringify({ event: "VERA_AI_DOSSIER", status: 200, role: req.user.role,
      suggestionStatus: dossier.suggestionStatus, durationMs: Date.now() - startedAt,
      promptTokens: dossier.usage?.promptTokens ?? null, completionTokens: dossier.usage?.completionTokens ?? null }));
    return res.json({ ...dossier, durationMs: Date.now() - startedAt });
  } catch (error) {
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return res.status(error.status).json({ message: error.message });
    }
    console.warn(JSON.stringify({ event: "VERA_AI_DOSSIER_ERROR", status: 502,
      durationMs: Date.now() - startedAt }));
    return res.status(502).json({ message: "No se pudo preparar el briefing del expediente." });
  }
});

router.post("/search-evidence", rateLimit({ windowMs: 15 * 60 * 1000, limit: 5,
  keyGenerator: (req) => String(req.user.id), standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  const startedAt = Date.now();
  const question = req.body?.question;
  const focus = req.body?.focus ?? null;
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 500 ||
      (focus !== null && (typeof focus !== "object" || Array.isArray(focus)))) {
    return res.status(400).json({ message: "Escribe una pregunta válida de 3 a 500 caracteres." });
  }
  try {
    if (!readiness().available || ((process.env.NODE_ENV === "production" ||
        process.env.VERCEL_ENV === "production") && process.env.VERA_EVIDENCE_COMMENT_STORE !== "supabase")) {
      return res.status(503).json({ message: "La búsqueda requiere Azure OpenAI y evidencias persistentes." });
    }
    const result = await searchAssistantEvidence(req.user, question.trim(), focus);
    const durationMs = Date.now() - startedAt;
    console.info(JSON.stringify({ event: "VERA_AI_EVIDENCE_SEARCH", status: 200, role: req.user.role,
      mode: result.mode, durationMs, promptTokens: result.usage?.prompt_tokens ?? null,
      completionTokens: result.usage?.completion_tokens ?? null }));
    return res.json({ ...result, durationMs, feedbackToken: issueFeedbackToken(req.user, "evidence-search", result.mode), usage: result.usage ? {
      promptTokens: result.usage.prompt_tokens ?? null,
      completionTokens: result.usage.completion_tokens ?? null
    } : null });
  } catch (error) {
    console.warn(JSON.stringify({ event: "VERA_AI_EVIDENCE_SEARCH_ERROR", status: error.status || 502,
      durationMs: Date.now() - startedAt }));
    if ([400, 403, 404, 503].includes(error.status)) return res.status(error.status).json({ message: error.message });
    return res.status(502).json({ message: "No se pudo buscar en las evidencias." });
  }
});

router.post("/ask", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: (req) => String(req.user.id),
  standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  const startedAt = Date.now();
  const question = req.body?.question;
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 800) {
    return res.status(400).json({ message: "Escribe una pregunta de 3 a 800 caracteres." });
  }
  const history = req.body?.history ?? [];
  const focus = req.body?.focus ?? null;
  if (!Array.isArray(history) || history.length > 6 || history.some((item) =>
    !item || !["user", "assistant"].includes(item.role) ||
    typeof item.text !== "string" || item.text.length > 800) ||
    (focus !== null && (typeof focus !== "object" || Array.isArray(focus)))) {
    return res.status(400).json({ message: "El historial o el expediente solicitado no es válido." });
  }
  try {
    const result = await answerAssistant(req.user, question.trim(), history, focus);
    const durationMs = Date.now() - startedAt;
    console.info(JSON.stringify({ event: result.mode === "computed" ? "VERA_AI_COMPUTED" : "VERA_AI_ANSWER",
      status: 200, role: req.user.role, durationMs, promptTokens: result.usage?.prompt_tokens ?? null,
      completionTokens: result.usage?.completion_tokens ?? null }));
    return res.json({ ...result, feedbackToken: issueFeedbackToken(req.user, "ask", result.mode), durationMs,
      usage: result.usage ? { promptTokens: result.usage.prompt_tokens ?? null,
        completionTokens: result.usage.completion_tokens ?? null } : null });
  } catch (error) {
    console.warn(JSON.stringify({ event: "VERA_AI_ERROR", status: error.status || 502,
      durationMs: Date.now() - startedAt }));
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({ message: "El servicio de IA tardó demasiado. Intenta de nuevo." });
    }
    return res.status(502).json({ message: "No se pudo consultar el asistente en este momento." });
  }
});

module.exports = router;
