const { buildAssistantContext, sourceFor } = require("./assistantContextService");
const { askAzureOpenAi } = require("./azureOpenAiService");

const MAX_ITEMS_PER_SECTION = 10;
const text = (value, limit = 160) => String(value ?? "").slice(0, limit);
const section = (key, label, type, items) => ({
  key, label, total: items.length,
  shown: Math.min(items.length, MAX_ITEMS_PER_SECTION),
  items: items.slice(0, MAX_ITEMS_PER_SECTION).map((item) => sourceFor(type, item))
});

const buildAuditDossier = async (user, auditId, { generate = true, ask = askAzureOpenAi } = {}) => {
  const { visibleRecords, asOf } = await buildAssistantContext(user, "briefing del expediente de auditoría", {
    type: "audit", id: auditId
  });
  const audit = visibleRecords.audits.find((item) => item.id === auditId);
  const risks = visibleRecords.risks.filter((item) => item.linkedAuditId === auditId);
  const riskIds = new Set(risks.map((item) => item.id));
  const controls = visibleRecords.controls.filter((item) => item.riskIds.some((id) => riskIds.has(id)));
  const findings = visibleRecords.findings.filter((item) => riskIds.has(item.riskId));
  const pending = visibleRecords.pending.filter((item) => item.entityId === auditId);
  const sections = [
    section("risks", "Riesgos vinculados", "risks", risks),
    section("controls", "Controles relacionados", "controls", controls),
    section("findings", "Hallazgos relacionados", "findings", findings),
    section("pending", "Pendientes para tu cuenta", "pending", pending)
  ];
  const auditSource = sourceFor("audits", audit);
  const sources = [auditSource, ...sections.flatMap((item) => item.items)];
  let suggestion = null;
  let suggestionStatus = generate ? "unavailable" : "disabled";
  let usage = null;

  if (generate) {
    const modelContext = {
      role: user.role,
      scope: "Solo el expediente y relaciones visibles para este usuario",
      focus: { type: "audit", id: audit.id, title: text(audit.title), status: audit.status,
        progress: audit.progress, objective: text(audit.objective, 500) },
      counts: Object.fromEntries(sections.map((item) => [item.key, item.total])),
      selection: Object.fromEntries(sections.map((item) => [item.key, { visible: item.total, included: item.shown }])),
      sources: sources.map(({ sourceId, type, id, title }) => ({ sourceId, type, id, title })),
      records: {
        audit: { id: audit.id, title: text(audit.title), status: audit.status, area: text(audit.area, 80),
          progress: audit.progress, objective: text(audit.objective, 500) },
        risks: risks.slice(0, MAX_ITEMS_PER_SECTION).map((item) => ({ id: item.id, title: text(item.title),
          level: item.level, score: item.score })),
        controls: controls.slice(0, MAX_ITEMS_PER_SECTION).map((item) => ({ id: item.id, title: text(item.title),
          effectiveness: item.effectiveness })),
        findings: findings.slice(0, MAX_ITEMS_PER_SECTION).map((item) => ({ id: item.id, title: text(item.title),
          status: item.status })),
        pending: pending.slice(0, MAX_ITEMS_PER_SECTION).map((item) => ({ id: item.id, title: text(item.title),
          priority: item.priority }))
      }
    };
    try {
      const result = await ask({ question: "Propón un solo siguiente paso concreto para revisar esta auditoría. " +
        "Escribe una frase breve, no afirmes que se ejecutó ninguna acción y cita al menos un registro que sustente la sugerencia. " +
        "Si faltan datos para proponerlo, indícalo sin inventar.", context: modelContext });
      const cited = result.sourceIds.map((id) => sources.find((item) => item.sourceId === id)).filter(Boolean);
      if (cited.length && result.answer.length <= 600) {
        suggestion = { text: result.answer, citations: cited };
        suggestionStatus = "generated";
      } else suggestionStatus = "uncited";
      usage = result.usage || null;
    } catch {
      // Los hechos calculados siguen disponibles cuando Azure no responde.
    }
  }

  return { audit: auditSource, sections, suggestion, suggestionStatus, asOf, usage: usage ? {
    promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null
  } : null,
    scope: "Registros vinculados visibles para tu cuenta", mode: "read-only" };
};

module.exports = { buildAuditDossier };
