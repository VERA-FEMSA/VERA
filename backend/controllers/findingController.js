const findingRepository = require("../repositories/findingRepository");
const controlRepository = require("../repositories/controlRepository");
const riskRepository = require("../repositories/riskRepository");
const actionRepository = require("../repositories/actionRepository");
const { ROLES, RISK_CONTROL_MANAGE_ROLES } = require("../config/roles");
const { logActivity } = require("../services/auditLogger");

const visibleTo = async (finding, user) => {
  if (user.role !== ROLES.AUDITOR) return true;
  const risk = await riskRepository.findById(finding.riskId);
  return risk?.ownerId === user.id;
};

const listFindings = async (req, res) => {
  const controlId = String(req.query.controlId ?? "").trim();
  const visible = [];
  for (const finding of await findingRepository.getAll()) {
    if (controlId && finding.controlId !== controlId) continue;
    if (await visibleTo(finding, req.user)) visible.push(finding);
  }
  res.json({ findings: visible });
};

const createFinding = async (req, res) => {
  const controlId = String(req.body.controlId ?? "").trim();
  const riskId = String(req.body.riskId ?? "").trim();
  const title = String(req.body.title ?? "").trim();
  const description = String(req.body.description ?? "").trim();
  if (!controlId || !riskId) return res.status(400).json({ message: "Selecciona un control y uno de sus riesgos vinculados." });
  if (title.length < 3 || title.length > 120) return res.status(400).json({ message: "El título debe tener entre 3 y 120 caracteres." });
  if (description.length < 10 || description.length > 2000) return res.status(400).json({ message: "La descripción debe tener entre 10 y 2,000 caracteres." });
  const control = await controlRepository.findById(controlId);
  if (!control || !control.riskIds.includes(riskId)) return res.status(404).json({ message: "No existe esa relación entre control y riesgo." });
  const risk = await riskRepository.findById(riskId);
  if (!risk) return res.status(404).json({ message: "Riesgo no encontrado." });
  if (!RISK_CONTROL_MANAGE_ROLES.includes(req.user.role) &&
      !(req.user.role === ROLES.AUDITOR && risk.ownerId === req.user.id)) {
    return res.status(403).json({ message: "No puedes registrar hallazgos para este riesgo." });
  }
  if (control.effectiveness >= 4) return res.status(409).json({ message: "Solo se puede abrir un hallazgo desde un control con efectividad insuficiente (1–3)." });
  const duplicate = (await findingRepository.getAll()).some((item) =>
    item.controlId === controlId && item.riskId === riskId && item.evaluationVersion === control.evaluations.length
  );
  if (duplicate) return res.status(409).json({ message: "Ya existe un hallazgo para este riesgo y evaluación del control." });
  const finding = await findingRepository.create({
    title, description, controlId, controlTitle: control.title,
    riskId, riskTitle: risk.title, auditId: risk.linkedAuditId || null,
    proposalId: risk.linkedAuditId || null,
    evaluationVersion: control.evaluations.length,
    createdBy: { id: req.user.id, username: req.user.username, role: req.user.role }
  });
  await logActivity({ actor: req.user, action: "FINDING_REGISTERED", details: {
    findingId: finding.id, controlId, riskId, auditId: finding.auditId
  } });
  res.status(201).json({ finding });
};

const closeFinding = async (req, res) => {
  const finding = await findingRepository.findById(req.params.id);
  if (!finding || !await visibleTo(finding, req.user)) {
    return res.status(404).json({ message: "El hallazgo no existe o no está disponible para tu cuenta." });
  }
  const risk = await riskRepository.findById(finding.riskId);
  if (!RISK_CONTROL_MANAGE_ROLES.includes(req.user.role) &&
      !(req.user.role === ROLES.AUDITOR && risk?.ownerId === req.user.id)) {
    return res.status(403).json({ message: "No puedes cerrar este hallazgo." });
  }
  if (finding.status !== "OPEN") return res.status(409).json({ message: "El hallazgo ya está cerrado." });
  const note = String(req.body?.note ?? "").trim();
  const version = Number(req.body?.version);
  if (note.length < 10 || note.length > 1000) {
    return res.status(400).json({ message: "Explica el cierre en 10 a 1,000 caracteres." });
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    return res.status(400).json({ message: "Actualiza el hallazgo antes de cerrarlo." });
  }
  const actions = (await actionRepository.getAll()).filter((item) =>
    item.sourceType === "FINDING" && item.sourceId === finding.id);
  if (!actions.length || actions.some((item) => item.status !== "DONE")) {
    return res.status(409).json({ message: "Termina todas las acciones vinculadas antes de cerrar el hallazgo." });
  }
  const closedAt = new Date().toISOString();
  const closed = await findingRepository.mutate(finding.id, {
    status: "CLOSED", closureNote: note, closedAt,
    closedBy: { id: req.user.id, username: req.user.username, role: req.user.role }
  }, version);
  await logActivity({ actor: req.user, action: "FINDING_CLOSED", details: {
    findingId: finding.id, riskId: finding.riskId, controlId: finding.controlId,
    completedActionIds: actions.map((item) => item.id)
  } });
  return res.json({ finding: closed });
};

module.exports = { listFindings, createFinding, closeFinding };
