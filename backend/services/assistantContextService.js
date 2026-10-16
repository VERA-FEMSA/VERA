const planningRepository = require("../repositories/planningRepository");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const findingRepository = require("../repositories/findingRepository");
const { buildNotifications } = require("./notificationService");

const LIMIT_PER_TYPE = 20;
const clean = (value, limit = 160) => String(value ?? "").slice(0, limit);
const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const rank = (items, question) => {
  const words = [...new Set(question.toLocaleLowerCase("es").match(/[\p{L}\p{N}]{3,}/gu) || [])];
  return items.map((item, index) => ({ item, index, score: words.reduce((total, word) =>
    total + (JSON.stringify(item).toLocaleLowerCase("es").includes(word) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, LIMIT_PER_TYPE)
    .map(({ item }) => item);
};

const buildAssistantContext = async (user, question) => {
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

  const selected = Object.fromEntries(Object.entries(records).map(([type, items]) => [type, rank(items, question)]));
  const query = normalize(question);
  const requested = {
    audits: /auditor|propuest|portafolio/.test(query),
    risks: /riesg/.test(query),
    controls: /control/.test(query),
    findings: /hallazg/.test(query),
    pending: /pendient|actividad|tarea/.test(query)
  };
  const linksFor = (type) => requested[type] ? selected[type].slice(0, 5) : [];
  const references = [
    ...linksFor("audits").map((item) => ({ type: "Auditoría", id: item.id, title: item.title,
      path: item.status === "ACTIVE" ? `/auditorias-activas/${encodeURIComponent(item.id)}` : "/planificacion" })),
    ...linksFor("risks").map((item) => ({ type: "Riesgo", id: item.id, title: item.title, path: "/riesgos" })),
    ...linksFor("controls").map((item) => ({ type: "Control", id: item.id, title: item.title, path: "/controles" })),
    ...linksFor("findings").map((item) => ({ type: "Hallazgo", id: item.id, title: item.title, path: "/controles" })),
    ...linksFor("pending").map((item) => ({ type: "Pendiente", id: item.id, title: item.title, path: "/notificaciones" }))
  ].slice(0, 15);

  return {
    context: {
      role: user.role,
      scope: auditor ? "Solo auditorías asignadas y riesgos bajo responsabilidad del usuario" : "Registros visibles para el rol autenticado",
      counts: Object.fromEntries(Object.entries(records).map(([type, items]) => [type, items.length])),
      sampleLimitPerType: LIMIT_PER_TYPE,
      records: selected
    },
    references
  };
};

module.exports = { buildAssistantContext };
