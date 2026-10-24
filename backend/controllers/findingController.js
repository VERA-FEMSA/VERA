const findingRepository = require("../repositories/findingRepository");
const riskRepository = require("../repositories/riskRepository");
const actionRepository = require("../repositories/actionRepository");
const { ROLES, RISK_CONTROL_MANAGE_ROLES } = require("../config/roles");
const { logActivity } = require("../services/auditLogger");
const { createFindingForUser } = require("../services/findingCreationService");

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
  try { return res.status(201).json({ finding: await createFindingForUser(req.user, req.body) }); }
  catch (error) {
    if ([400, 403, 404, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
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
