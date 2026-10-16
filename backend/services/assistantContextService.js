const planningRepository = require("../repositories/planningRepository");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const findingRepository = require("../repositories/findingRepository");
const { ROLES } = require("../config/roles");
const { buildNotifications } = require("./notificationService");

const LIMIT_PER_TYPE = 20;
const clean = (value, limit = 160) => String(value ?? "").slice(0, limit);
const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const sourceFor = (type, item) => {
  const label = { audits: "Auditoría", risks: "Riesgo", controls: "Control",
    findings: "Hallazgo", pending: "Pendiente" }[type];
  const path = type === "audits"
    ? (item.status === "ACTIVE" ? `/auditorias-activas/${encodeURIComponent(item.id)}` : "/planificacion")
    : { risks: `/riesgos#risk-${encodeURIComponent(item.id)}`,
      controls: `/controles#control-${encodeURIComponent(item.id)}`,
      findings: `/controles#finding-${encodeURIComponent(item.id)}`,
      pending: "/notificaciones" }[type];
  return { sourceId: `${type}:${item.id}`, type: label, id: item.id, title: item.title, path };
};

const rank = (items, question, preferred = new Set()) => {
  const words = [...new Set(normalize(question).match(/[\p{L}\p{N}]{3,}/gu) || [])];
  return items.map((item, index) => ({ item, index, score: (preferred.has(item.id) ? 100 : 0) + words.reduce((total, word) =>
    total + (normalize(JSON.stringify(item)).includes(word) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, LIMIT_PER_TYPE)
    .map(({ item }) => item);
};

const buildAssistantContext = async (user, question, focus = null) => {
  if (!Object.values(ROLES).includes(user.role)) {
    const error = new Error("Este rol no tiene acceso al asistente.");
    error.status = 403;
    throw error;
  }
  if (focus && (!new Set(["audit", "risk", "control", "finding"]).has(focus.type) ||
      typeof focus.id !== "string" || !focus.id.trim() || focus.id.length > 80)) {
    const error = new Error("Selecciona un expediente válido.");
    error.status = 400;
    throw error;
  }
  const [allAudits, allRisks, allControls, allFindings] = await Promise.all([
    planningRepository.getAll(), riskRepository.getAll(), controlRepository.getAll(), findingRepository.getAll()
  ]);
  const auditor = user.role === "AUDITOR";
  const audits = auditor ? allAudits.filter((item) => item.responsibleId === user.id) : allAudits;
  const risks = auditor ? allRisks.filter((item) => item.ownerId === user.id) : allRisks;
  const riskIds = new Set(risks.map((item) => item.id));
  const controls = auditor
    ? allControls.filter((item) => item.riskIds.some((id) => riskIds.has(id)))
    : allControls;
  const findings = auditor ? allFindings.filter((item) => riskIds.has(item.riskId)) : allFindings;
  const notifications = buildNotifications({ proposals: allAudits, user });
  // Este alcance coincide con los endpoints de lectura de cada módulo. El
  // expediente se resuelve después de filtrar, para no revelar su existencia.
  const visibleByType = { audit: audits, risk: risks, control: controls, finding: findings };
  const focused = focus ? visibleByType[focus.type].find((item) => item.id === focus.id) : null;
  if (focus && !focused) {
    const error = new Error("El expediente no existe o no está disponible para tu cuenta.");
    error.status = 404;
    throw error;
  }
  const preferred = {
    audits: new Set(), risks: new Set(), controls: new Set(),
    findings: new Set(), pending: new Set()
  };
  if (focus) {
    const type = { audit: "audits", risk: "risks", control: "controls", finding: "findings" }[focus.type];
    preferred[type].add(focus.id);
    if (focus.type === "audit") risks.filter((item) => item.linkedAuditId === focus.id)
      .forEach((item) => preferred.risks.add(item.id));
    if (focus.type === "risk") {
      if (focused.linkedAuditId) preferred.audits.add(focused.linkedAuditId);
      controls.filter((item) => item.riskIds.includes(focus.id))
        .forEach((item) => preferred.controls.add(item.id));
      findings.filter((item) => item.riskId === focus.id)
        .forEach((item) => preferred.findings.add(item.id));
    }
    if (focus.type === "control") focused.riskIds.forEach((id) => preferred.risks.add(id));
    if (focus.type === "finding") {
      preferred.risks.add(focused.riskId);
      preferred.controls.add(focused.controlId);
    }
  }

  const records = {
    audits: audits.map((item) => ({ id: clean(item.id, 50), title: clean(item.title), status: item.status,
      area: clean(item.area, 80), risk: item.risk, progress: item.progress ?? 0 })),
    risks: risks.map((item) => ({ id: clean(item.id, 50), title: clean(item.title), level: item.level,
      score: item.score, linkedAuditId: item.linkedAuditId || null })),
    controls: controls.map((item) => ({ id: clean(item.id, 50), title: clean(item.title),
      riskIds: item.riskIds.filter((id) => riskIds.has(id)), effectiveness: item.effectiveness })),
    findings: findings.map((item) => ({ id: clean(item.id, 50), title: clean(item.title),
      riskId: item.riskId, controlId: item.controlId, status: item.status })),
    pending: notifications.map((item) => ({ id: clean(item.id, 80), title: clean(item.title),
      entityId: item.entityId, priority: item.priority }))
  };

  const selected = Object.fromEntries(Object.entries(records).map(([type, items]) =>
    [type, rank(items, question, preferred[type])]));
  const query = normalize(question);
  const requested = {
    audits: /auditor|propuest|portafolio/.test(query),
    risks: /riesg/.test(query),
    controls: /control/.test(query),
    findings: /hallazg/.test(query),
    pending: /pendient|actividad|tarea/.test(query)
  };
  const sourceCatalog = Object.entries(selected).flatMap(([type, items]) =>
    items.map((item) => sourceFor(type, item)));
  const references = Object.entries(selected).flatMap(([type, items]) =>
    items.filter((item) => requested[type] || preferred[type].has(item.id))
      .slice(0, 5).map((item) => sourceFor(type, item))).slice(0, 15);
  const brief = [
    { key: "highRisks", label: "Riesgos altos", count: risks.filter((item) => item.level === "Alto").length, path: "/riesgos" },
    { key: "ineffectiveControls", label: "Controles por revisar", count: controls.filter((item) => Number(item.effectiveness) < 4).length, path: "/controles" },
    { key: "openFindings", label: "Hallazgos abiertos", count: findings.filter((item) => item.status === "OPEN").length, path: "/controles" },
    { key: "urgentPending", label: "Pendientes prioritarios", count: notifications.filter((item) => item.priority === "HIGH").length, path: "/notificaciones" },
    { key: "activeAudits", label: "Auditorías activas", count: audits.filter((item) => item.status === "ACTIVE").length, path: "/auditorias-activas" }
  ];

  return {
    context: {
      role: user.role,
      scope: auditor ? "Solo auditorías asignadas y riesgos bajo responsabilidad del usuario" : "Portafolio completo según los módulos de lectura actuales",
      counts: Object.fromEntries(Object.entries(records).map(([type, items]) => [type, items.length])),
      sampleLimitPerType: LIMIT_PER_TYPE,
      focus: focused ? { type: focus.type, id: focus.id, title: clean(focused.title),
        description: clean(focused.description, 700), objective: clean(focused.objective, 500),
        responsePlan: clean(focused.responsePlan, 500), status: focused.status,
        level: focused.level, score: focused.score,
        linkedAuditId: focused.linkedAuditId || null,
        riskIds: Array.isArray(focused.riskIds) ? focused.riskIds.filter((id) => riskIds.has(id)) : [],
        evaluations: Array.isArray(focused.evaluations) ? focused.evaluations.slice(-3).map((item) => ({
          score: item.score, level: item.level, rating: item.rating,
          date: item.assessedAt || item.createdAt || null
        })) : [] } : null,
      sources: sourceCatalog.map(({ sourceId, type, id, title }) => ({ sourceId, type, id, title })),
      records: selected
    },
    references, sourceCatalog, brief
  };
};

module.exports = { buildAssistantContext };
