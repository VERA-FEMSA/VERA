const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { verifyToken } = require("../middleware/authMiddleware");
const { buildAssistantContext } = require("../services/assistantContextService");
const { getVerifiedAnswer } = require("../services/assistantVerifiedAnswers");
const { askAzureOpenAi, readiness } = require("../services/azureOpenAiService");
const { buildAuditDossier } = require("../services/assistantDossierService");

const router = express.Router();
router.use(verifyToken);
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

router.get("/status", (req, res) => {
  try {
    res.json({ ...readiness(), mode: "read-only" });
  } catch {
    res.json({ available: false, reason: "invalid-configuration", mode: "read-only" });
  }
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
    if (!readiness().available) return res.status(503).json({ message: "El asistente requiere Azure OpenAI y almacenes persistentes en producción." });
    const { context, references, sourceCatalog, brief, verifiedData, coverage, asOf } = await buildAssistantContext(req.user, question.trim(), focus);
    const verified = getVerifiedAnswer({ question: question.trim(), context, brief, sourceCatalog, verifiedData });
    if (verified) {
      const citations = verified.sourceIds.map((id) => sourceCatalog.find((item) => item.sourceId === id)).filter(Boolean);
      const durationMs = Date.now() - startedAt;
      console.info(JSON.stringify({ event: "VERA_AI_COMPUTED", status: 200, role: req.user.role, durationMs }));
      return res.json({ answer: verified.answer, mode: verified.mode, metric: verified.metric || null,
        citations, references: verified.references ?? (verified.metric ? [] : references), coverage, asOf, durationMs, usage: null });
    }
    const { answer, sourceIds, usage } = await askAzureOpenAi({ question: question.trim(), context, history });
    const citations = sourceIds.map((id) => sourceCatalog.find((item) => item.sourceId === id)).filter(Boolean);
    console.info(JSON.stringify({ event: "VERA_AI_ANSWER", status: 200, role: req.user.role,
      durationMs: Date.now() - startedAt, promptTokens: usage?.prompt_tokens ?? null,
      completionTokens: usage?.completion_tokens ?? null }));
    return res.json({ answer, mode: "generated", citations, references, coverage, asOf, durationMs: Date.now() - startedAt, usage: usage ? {
      promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null
    } : null });
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
