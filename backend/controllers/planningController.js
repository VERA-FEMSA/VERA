const planningRepository = require("../repositories/planningRepository");
const { logActivity } = require("../services/auditLogger");
const { ROLES } = require("../config/roles");
const { EDITABLE_FIELDS_BY_STATUS, FIELD_LABELS, STATUS_LABELS } = require("../config/auditEditRules");
const { parseAuditFilters, searchAudits } = require("../services/auditSearch");
const { applyTransition } = require("../services/planningTransitionService");
const { parseProposal, activeAuditors, createProposalForUser, updateProposalForUser } = require("../services/proposalService");

const isTerminal = (proposal) => ["APPROVED", "ACTIVE", "CLOSED", "REJECTED"].includes(proposal.status);

// GET /api/planning
const listProposals = async (req, res) => {
  const proposals = await planningRepository.getAll();
  const visible = req.user.role === ROLES.AUDITOR
    ? proposals.filter((proposal) => proposal.responsibleId === req.user.id)
    : proposals;
  res.json({ proposals: visible });
};

// GET /api/planning/search: filtra únicamente expedientes visibles para la sesión.
const searchPlanningAudits = async (req, res) => {
  const { filters, error } = parseAuditFilters(req.query);
  if (error) return res.status(400).json({ message: error });
  const proposals = await planningRepository.getAll();
  const visible = req.user.role === ROLES.AUDITOR
    ? proposals.filter((proposal) => proposal.responsibleId === req.user.id)
    : proposals;
  res.json({ audits: searchAudits(visible, filters) });
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
  try { return res.status(201).json({ proposal: await createProposalForUser(req.user, req.body) }); }
  catch (error) {
    if ([400, 403, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};

// PUT /api/planning/:id  (solo propuestas abiertas)
const updateProposal = async (req, res) => {
  try { return res.json({ proposal: await updateProposalForUser(req.user, req.params.id, req.body || {}) }); }
  catch (error) {
    if ([400, 403, 404, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};

// La interfaz y el chat comparten las mismas reglas y la misma bitácora.
const respondToTransition = async (req, res, operation) => {
  try {
    const { kind, record } = await applyTransition(req.user, req.params.id, operation, req.body || {});
    return res.json({ [kind]: record });
  } catch (error) {
    if ([400, 403, 404, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};
const approveProposal = (req, res) => respondToTransition(req, res, "approve");
const rejectProposal = (req, res) => respondToTransition(req, res, "reject");
const startAudit = (req, res) => respondToTransition(req, res, "start");
const closeAudit = (req, res) => respondToTransition(req, res, "close");

// DELETE /api/planning/:id  (solo propuestas abiertas)
const deleteProposal = async (req, res) => {
  const current = await planningRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Propuesta no encontrada." });
  if (isTerminal(current)) {
    return res.status(409).json({ message: "Una propuesta resuelta ya no se puede eliminar." });
  }

  await planningRepository.remove(current.id, current.storageVersion);

  await logActivity({
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

  await logActivity({
    actor: req.user,
    action: "AUDIT_UPDATED",
    details: { proposalId: audit.id, title: audit.title, status: audit.status, changes }
  });

  res.json({ audit, changes });
};

module.exports = {
  parseProposal,
  listProposals,
  searchPlanningAudits,
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
