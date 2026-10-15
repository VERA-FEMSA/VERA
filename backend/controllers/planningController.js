const planningRepository = require("../repositories/planningRepository");
const userRepository = require("../repositories/userRepository");
const { logActivity } = require("../services/auditLogger");
const { ROLES } = require("../config/roles");
const { USER_STATUS } = require("../config/accountRules");
const { classifyRisk } = require("../config/riskRules");
const { EDITABLE_FIELDS_BY_STATUS, FIELD_LABELS, STATUS_LABELS } = require("../config/auditEditRules");


const TYPES = ["Interna", "Externa"];
const RISKS = ["Bajo", "Medio", "Alto"];
const RISK_FACTOR_LEVELS = [1, 2, 3];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;

const DUPLICATE_MESSAGE = "Ya existe una propuesta con el mismo título, área y año.";
const isTerminal = (proposal) => ["APPROVED", "ACTIVE", "CLOSED", "REJECTED"].includes(proposal.status);
const text = (value) => String(value ?? "").trim();
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const activeAuditors = async () =>
  (await userRepository.getAll())
    .filter((u) => u.role === ROLES.AUDITOR && u.status === USER_STATUS.ACTIVE)
    .map((u) => ({ id: u.id, name: u.name, username: u.username }));

// Valida y limpia el cuerpo de una propuesta. Regresa { error } o { data }.
const parseProposal = async (body) => {
  const title = text(body.title);
  const objective = text(body.objective);
  const scope = text(body.scope);
  const justification = text(body.justification);
  const area = text(body.area);
  const type = text(body.type) || "Interna";
  const requestedRisk = text(body.risk) || "Medio";
  const fallbackFactor = requestedRisk === "Bajo" ? 1 : requestedRisk === "Alto" ? 3 : 2;
  const likelihood = body.likelihood === undefined ? fallbackFactor : Number(body.likelihood);
  const impact = body.impact === undefined ? fallbackFactor : Number(body.impact);
  const quarter = text(body.quarter);
  const year = Number(body.year) || new Date().getFullYear();
  const startDate = text(body.startDate);
  const endDate = text(body.endDate);

  if (!title || !objective || !scope || !justification || !area) {
    return { error: "Completa el título, el área, el objetivo, el alcance y la justificación de la propuesta." };
  }
  if (scope.length > 2000 || justification.length > 2000) {
    return { error: "El alcance y la justificación no pueden superar 2000 caracteres." };
  }
  if (!TYPES.includes(type)) return { error: "El tipo de auditoría no es válido." };
  if (!RISKS.includes(requestedRisk)) return { error: "El nivel de riesgo no es válido." };
  if (!RISK_FACTOR_LEVELS.includes(likelihood) || !RISK_FACTOR_LEVELS.includes(impact)) {
    return { error: "La probabilidad y el impacto deben ser niveles del 1 al 3." };
  }
  if (quarter && !QUARTERS.includes(quarter)) return { error: "El trimestre no es válido." };
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return { error: "El año no es válido." };
  }
  if ((startDate && !isDate(startDate)) || (endDate && !isDate(endDate))) {
    return { error: "Las fechas no tienen un formato válido." };
  }
  if (startDate && endDate && endDate < startDate) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio." };
  }
  if (Boolean(startDate) !== Boolean(endDate)) {
    return { error: "Indica ambas fechas del periodo estimado." };
  }
  if (!quarter && !startDate) {
    return { error: "Indica un trimestre o ambas fechas del periodo estimado." };
  }

  let responsibleId = null;
  let responsible = "Sin asignar";
  const rawResponsible = body.responsibleId;
  if (rawResponsible !== undefined && rawResponsible !== null && rawResponsible !== "") {
    const auditor = (await activeAuditors()).find((a) => a.id === Number(rawResponsible));
    if (!auditor) return { error: "El responsable debe ser un auditor activo." };
    responsibleId = auditor.id;
    responsible = auditor.name;
  }

  return {
    data: {
      title,
      objective,
      scope,
      justification,
      area,
      type,
      likelihood,
      impact,
      riskScore: likelihood * impact,
      risk: classifyRisk(likelihood * impact),
      quarter,
      year,
      startDate,
      endDate,
      responsibleId,
      responsible
    }
  };
};

// GET /api/planning
const listProposals = async (req, res) => {
  const proposals = await planningRepository.getAll();
  const visible = req.user.role === ROLES.AUDITOR
    ? proposals.filter((proposal) => proposal.responsibleId === req.user.id)
    : proposals;
  res.json({ proposals: visible });
};

// GET /api/planning/active
const listActiveAudits = async (req, res) => {
  const audits = (await planningRepository.getAll()).filter((item) =>
    item.status === "ACTIVE" && (req.user.role !== ROLES.AUDITOR || item.responsibleId === req.user.id)
  );
  res.json({ audits });
};

// GET /api/planning/auditors
const listAuditors = async (req, res) => {
  res.json({ auditors: await activeAuditors() });
};

// POST /api/planning
const createProposal = async (req, res) => {
  const { data, error } = await parseProposal(req.body);
  if (error) return res.status(400).json({ message: error });

  if (await planningRepository.findDuplicate(data)) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  const proposal = await planningRepository.create({
    ...data,
    createdBy: { id: req.user.id, name: req.user.username }
  });

  logActivity({
    actor: req.user,
    action: "AUDIT_PROPOSAL_CREATED",
    details: { proposalId: proposal.id, title: proposal.title }
  });

  res.status(201).json({ proposal });
};

// PUT /api/planning/:id  (solo propuestas abiertas)
const updateProposal = async (req, res) => {
  const current = await planningRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Propuesta no encontrada." });
  if (req.user.role === ROLES.JEFATURA && current.createdBy?.id !== req.user.id) {
    return res.status(403).json({ message: "Solo puedes editar las propuestas que creaste." });
  }
  if (isTerminal(current)) {
    return res.status(409).json({ message: "Una propuesta resuelta ya no se puede editar." });
  }

  const { data, error } = await parseProposal(req.body);
  if (error) return res.status(400).json({ message: error });

  if (await planningRepository.findDuplicate(data, current.id)) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  const proposal = await planningRepository.update(current.id, data, current.storageVersion);

  logActivity({
    actor: req.user,
    action: "AUDIT_PROPOSAL_UPDATED",
    details: { proposalId: proposal.id, title: proposal.title }
  });

  res.json({ proposal });
};

// POST /api/planning/:id/approve
const approveProposal = async (req, res) => {
  const current = await planningRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Propuesta no encontrada." });
  if (isTerminal(current)) {
    return res.status(409).json({ message: "Esta propuesta ya fue resuelta." });
  }

  const quarter = text(req.body.quarter) || current.quarter;
  if (!QUARTERS.includes(quarter)) {
    return res.status(400).json({ message: "Selecciona un trimestre para completar la aprobación." });
  }

  const proposal = await planningRepository.approve(current.id, {
    quarter,
    approvedBy: { id: req.user.id, name: req.user.username }
  }, current.storageVersion);

  logActivity({
    actor: req.user,
    action: "AUDIT_PROPOSAL_APPROVED",
    details: { proposalId: proposal.id, title: proposal.title, quarter }
  });

  res.json({ proposal });
};

// POST /api/planning/:id/start
const startAudit = async (req, res) => {
  const current = await planningRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Auditoría no encontrada." });
  if (current.status !== "APPROVED") {
    return res.status(409).json({ message: "Solo se pueden iniciar auditorías aprobadas y pendientes de ejecución." });
  }

  const audit = await planningRepository.start(current.id, {
    startedBy: { id: req.user.id, name: req.user.username }
  }, current.storageVersion);
  logActivity({
    actor: req.user,
    action: "AUDIT_STARTED",
    details: { auditId: audit.id, title: audit.title }
  });
  res.json({ audit });
};

// POST /api/planning/:id/close
const closeAudit = async (req, res) => {
  const current = await planningRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Auditoría no encontrada." });
  if (current.status !== "ACTIVE") {
    return res.status(409).json({ message: "Solo se pueden cerrar auditorías en curso." });
  }

  const audit = await planningRepository.close(current.id, {
    closedBy: { id: req.user.id, name: req.user.username }
  }, current.storageVersion);
  logActivity({
    actor: req.user,
    action: "AUDIT_CLOSED",
    details: { auditId: audit.id, title: audit.title }
  });
  res.json({ audit });
};

// POST /api/planning/:id/reject
const rejectProposal = async (req, res) => {
  const current = await planningRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Propuesta no encontrada." });
  if (isTerminal(current)) {
    return res.status(409).json({ message: "Esta propuesta ya fue resuelta." });
  }

  const rejectionReason = text(req.body.reason);
  if (!rejectionReason) {
    return res.status(400).json({ message: "Escribe el motivo del rechazo." });
  }

  const proposal = await planningRepository.reject(current.id, {
    rejectionReason,
    rejectedBy: { id: req.user.id, name: req.user.username }
  }, current.storageVersion);

  logActivity({
    actor: req.user,
    action: "AUDIT_PROPOSAL_REJECTED",
    details: { proposalId: proposal.id, title: proposal.title, reason: rejectionReason }
  });

  res.json({ proposal });
};

// DELETE /api/planning/:id  (solo propuestas abiertas)
const deleteProposal = async (req, res) => {
  const current = await planningRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Propuesta no encontrada." });
  if (isTerminal(current)) {
    return res.status(409).json({ message: "Una propuesta resuelta ya no se puede eliminar." });
  }

  await planningRepository.remove(current.id, current.storageVersion);

  logActivity({
    actor: req.user,
    action: "AUDIT_PROPOSAL_DELETED",
    details: { proposalId: current.id, title: current.title }
  });

  res.json({ message: "Propuesta eliminada." });
};

// PATCH /api/planning/:id/details  (HU-12)
// Edita una auditoría aprobada o en curso. Solo acepta los campos permitidos para su estado.
const editAudit = async (req, res) => {
  const current = await planningRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Auditoría no encontrada." });

  const allowed = EDITABLE_FIELDS_BY_STATUS[current.status];
  if (!allowed) {
    const estado = STATUS_LABELS[current.status] || current.status;
    return res.status(409).json({ message: `Una auditoría ${estado} no se puede editar desde aquí.` });
  }

  const body = req.body || {};
  const sent = Object.keys(body);
  if (sent.length === 0) {
    return res.status(400).json({ message: "Indica al menos un dato para modificar." });
  }

  const blocked = sent.filter((field) => !allowed.includes(field));
  if (blocked.length > 0) {
    const names = blocked.map((field) => FIELD_LABELS[field] || field).join(", ");
    return res.status(400).json({
      message: `No se puede modificar ${names} en una auditoría ${STATUS_LABELS[current.status]}.`
    });
  }

  // Se valida la auditoría completa con los cambios aplicados, reutilizando las reglas de HU-22.
  const { data, error } = await parseProposal({ ...current, ...body });
  if (error) return res.status(400).json({ message: error });
  if (current.status === "APPROVED" && !data.quarter) {
    return res.status(400).json({ message: "Una auditoría aprobada debe conservar un trimestre." });
  }

  const changes = {};
  for (const field of allowed) {
    const before = current[field] ?? null;
    const after = data[field] ?? null;
    if (String(before ?? "") !== String(after ?? "")) changes[field] = { from: before, to: after };
  }
  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ message: "No hay cambios que guardar." });
  }

  const update = {};
  for (const field of Object.keys(changes)) update[field] = data[field];
  if (changes.responsibleId) update.responsible = data.responsible;
  if (changes.likelihood || changes.impact) {
    update.riskScore = data.riskScore;
    update.risk = data.risk;
  }

  const audit = await planningRepository.update(current.id, update, current.storageVersion);

  logActivity({
    actor: req.user,
    action: "AUDIT_UPDATED",
    details: { proposalId: audit.id, title: audit.title, status: audit.status, changes }
  });

  res.json({ audit, changes });
};

module.exports = {
  parseProposal,
  listProposals,
  listActiveAudits,
  listAuditors,
  createProposal,
  updateProposal,
  approveProposal,
  startAudit,
  closeAudit,
  rejectProposal,
  deleteProposal,
  editAudit
};
