const evidenceRepository = require("../repositories/evidenceRepository");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const planningRepository = require("../repositories/planningRepository");
const userRepository = require("../repositories/userRepository");
const { logActivity } = require("../services/auditLogger");
const { ROLES } = require("../config/roles");

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
  if (type === "RISK") return riskRepository.findById(id)?.ownerId === user.id;
  if (type === "AUDIT") return (await planningRepository.findById(id))?.responsibleId === user.id;
  if (type === "CONTROL") {
    const control = controlRepository.findById(id);
    return Boolean(control && control.riskIds.some((riskId) => riskRepository.findById(riskId)?.ownerId === user.id));
  }
  return false;
};

const listEvidence = async (req, res) => {
  const { entityType, entityId, search } = req.query;
  const needle = text(search).toLowerCase();
  const items = [];
  for (const item of evidenceRepository.getAll()) {
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
  const evidence = evidenceRepository.create({
    title,
    description,
    evidenceType,
    reference,
    entityType,
    entityId,
    entityTitle: entity.title,
    author: { id: req.user.id, username: req.user.username, name: author?.name || req.user.username, role: req.user.role }
  });
  logActivity({ actor: req.user, action: "EVIDENCE_REGISTERED", details: { evidenceId: evidence.id, title: evidence.title, entityType, entityId, entityTitle: entity.title } });
  res.status(201).json({ evidence });
};

module.exports = { listEvidence, createEvidence };
