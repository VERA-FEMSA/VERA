const riskRepository = require("../repositories/riskRepository");
const userRepository = require("../repositories/userRepository");
const planningRepository = require("../repositories/planningRepository");
const { logActivity } = require("../services/auditLogger");
const { USER_STATUS } = require("../config/accountRules");
const { parseAssessment, evaluateRiskForUser } = require("../services/riskEvaluationService");
const { normalizeArea } = require("../utils/normalizeArea");

const text = (value) => String(value ?? "").trim();
const activeUsers = async () => (await userRepository.getAll()).filter((user) => user.status === USER_STATUS.ACTIVE);

const parseCore = async (body) => {
  const title = text(body.title);
  const description = text(body.description);
  const area = text(body.area);
  const responsePlan = text(body.responsePlan);
  const ownerId = Number(body.ownerId);
  const owner = (await activeUsers()).find((user) => user.id === ownerId);
  const linkedAuditId = text(body.linkedAuditId);

  if (title.length < 3 || title.length > 140) return { error: "El nombre debe tener entre 3 y 140 caracteres." };
  if (description.length < 10 || description.length > 2000) return { error: "La descripción debe tener entre 10 y 2,000 caracteres." };
  if (!area || area.length > 100) return { error: "El área es obligatoria y admite hasta 100 caracteres." };
  if (!owner) return { error: "Selecciona una persona responsable con cuenta activa." };
  if (responsePlan.length > 2000) return { error: "El plan de respuesta admite hasta 2,000 caracteres." };
  if (linkedAuditId && !await planningRepository.findById(linkedAuditId)) {
    return { error: "La auditoría relacionada no existe." };
  }

  return {
    data: {
      title,
      description,
      area,
      ownerId: owner.id,
      ownerName: owner.name,
      responsePlan,
      linkedAuditId: linkedAuditId || null
    }
  };
};

const listRisks = async (req, res) => {
  const { level, search, area } = req.query;
  const needle = text(search).toLowerCase();
  let risks = await riskRepository.getAll();
  if (req.user.role === "AUDITOR") risks = risks.filter((risk) => risk.ownerId === req.user.id);
  if (["Bajo", "Medio", "Alto"].includes(level)) risks = risks.filter((risk) => risk.level === level);
  if (area) risks = risks.filter((risk) => normalizeArea(risk.area) === normalizeArea(area));
  if (needle) risks = risks.filter((risk) => `${risk.title} ${risk.description} ${risk.area} ${risk.ownerName}`.toLowerCase().includes(needle));
  res.json({ risks });
};

const listOwners = async (req, res) => {
  res.json({ owners: (await activeUsers()).map(({ id, name, username, role }) => ({ id, name, username, role })) });
};

const createRisk = async (req, res) => {
  const core = await parseCore(req.body);
  if (core.error) return res.status(400).json({ message: core.error });
  const assessment = parseAssessment(req.body);
  if (assessment.error) return res.status(400).json({ message: assessment.error });

  if (await riskRepository.findDuplicate(core.data)) {
    return res.status(409).json({ message: "Ya existe un riesgo con el mismo nombre y área." });
  }

  const risk = await riskRepository.create({
    ...core.data,
    ...assessment.data,
    createdBy: { id: req.user.id, name: req.user.username }
  });
  await logActivity({
    actor: req.user,
    action: "RISK_REGISTERED",
    details: { riskId: risk.id, title: risk.title, level: risk.level, score: risk.score }
  });
  res.status(201).json({ risk });
};

const updateRisk = async (req, res) => {
  const current = await riskRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Riesgo no encontrado." });
  const core = await parseCore(req.body);
  if (core.error) return res.status(400).json({ message: core.error });
  if (await riskRepository.findDuplicate(core.data, current.id)) {
    return res.status(409).json({ message: "Ya existe un riesgo con el mismo nombre y área." });
  }
  const risk = await riskRepository.update(current.id, core.data, current.storageVersion);
  await logActivity({ actor: req.user, action: "RISK_UPDATED", details: { riskId: risk.id, title: risk.title } });
  res.json({ risk });
};

const evaluateRisk = async (req, res) => {
  try { res.json({ risk: await evaluateRiskForUser(req.user, req.params.id, req.body) }); }
  catch (error) { res.status(error.status || 502).json({ message: error.status ? error.message : "No se pudo evaluar el riesgo." }); }
};

module.exports = { listRisks, listOwners, createRisk, updateRisk, evaluateRisk };
