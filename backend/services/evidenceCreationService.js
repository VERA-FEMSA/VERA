const evidenceRepository = require("../repositories/evidenceRepository");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const planningRepository = require("../repositories/planningRepository");
const userRepository = require("../repositories/userRepository");
const { logActivity } = require("./auditLogger");
const { RECORD_CREATE_ROLES, ROLES } = require("../config/roles");

const ENTITY_TYPES = ["RISK", "CONTROL", "AUDIT"];
const EVIDENCE_TYPES = ["DOCUMENT", "SCREENSHOT", "REPORT", "OTHER"];
const text = (value) => String(value ?? "").trim();
const errorFor = (message, status) => { const error = new Error(message); error.status = status; return error; };

const findEntity = async (type, id) => {
  if (type === "RISK") return riskRepository.findById(id);
  if (type === "CONTROL") return controlRepository.findById(id);
  if (type === "AUDIT") return planningRepository.findById(id);
  return null;
};

const canAccessEntity = async (type, id, user) => {
  if (user.role !== ROLES.AUDITOR) return Boolean(await findEntity(type, id));
  if (type === "RISK") return (await riskRepository.findById(id))?.ownerId === user.id;
  if (type === "AUDIT") return (await planningRepository.findById(id))?.responsibleId === user.id;
  if (type === "CONTROL") {
    const control = await controlRepository.findById(id);
    if (!control) return false;
    const risks = await Promise.all(control.riskIds.map((riskId) => riskRepository.findById(riskId)));
    return risks.some((risk) => risk?.ownerId === user.id);
  }
  return false;
};

const parseEvidence = async (user, body) => {
  const title = text(body.title);
  const description = text(body.description);
  const evidenceType = text(body.evidenceType);
  const reference = text(body.reference);
  const entityType = text(body.entityType);
  const entityId = text(body.entityId);
  if (title.length < 3 || title.length > 120) throw errorFor("El nombre debe tener entre 3 y 120 caracteres.", 400);
  if (description.length < 10 || description.length > 1000) {
    throw errorFor("La descripción debe tener entre 10 y 1,000 caracteres.", 400);
  }
  if (!EVIDENCE_TYPES.includes(evidenceType)) throw errorFor("Selecciona un tipo de evidencia válido.", 400);
  if (reference.length < 3 || reference.length > 500 || /^(javascript|data|vbscript):/i.test(reference)) {
    throw errorFor("Captura un enlace HTTPS o una referencia de 3 a 500 caracteres.", 400);
  }
  if (!ENTITY_TYPES.includes(entityType) || !entityId) {
    throw errorFor("Selecciona un riesgo, control o auditoría para relacionar la evidencia.", 400);
  }
  const entity = await findEntity(entityType, entityId);
  if (!entity || !await canAccessEntity(entityType, entityId, user)) {
    throw errorFor("El elemento relacionado no existe.", 404);
  }
  return { title, description, evidenceType, reference, entityType, entityId, entityTitle: entity.title };
};

const createEvidenceForUser = async (user, body, operationId = null) => {
  const current = await userRepository.findById(user.id);
  if (current?.status !== "ACTIVE" || current.role !== user.role) {
    throw errorFor("Cambió tu acceso. Inicia sesión de nuevo.", 409);
  }
  if (!RECORD_CREATE_ROLES.includes(user.role)) throw errorFor("Tu rol no puede registrar evidencias.", 403);
  if (operationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
    throw errorFor("La operación no es válida.", 400);
  }
  const data = await parseEvidence(user, body);
  if (operationId) {
    const existing = (await evidenceRepository.getAll()).find((item) => item.aiOperationId === operationId);
    if (existing) return existing;
  }
  const evidence = await evidenceRepository.create({ ...data,
    ...(operationId ? { aiOperationId: operationId } : {}),
    author: { id: user.id, username: user.username, name: current.name || user.username, role: user.role } });
  await logActivity({ actor: user, action: "EVIDENCE_REGISTERED", details: {
    evidenceId: evidence.id, title: evidence.title, entityType: evidence.entityType,
    entityId: evidence.entityId, entityTitle: evidence.entityTitle } });
  return evidence;
};

module.exports = { EVIDENCE_TYPES, ENTITY_TYPES, findEntity, canAccessEntity, parseEvidence, createEvidenceForUser };
