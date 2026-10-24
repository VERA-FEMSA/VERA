const riskRepository = require("../repositories/riskRepository");
const { logActivity } = require("../services/auditLogger");
const { evaluateRiskForUser } = require("../services/riskEvaluationService");
const { activeUsers, parseCore, createRiskForUser } = require("../services/riskCreationService");
const { normalizeArea } = require("../utils/normalizeArea");

const text = (value) => String(value ?? "").trim();
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
  try { return res.status(201).json({ risk: await createRiskForUser(req.user, req.body) }); }
  catch (error) {
    if ([400, 403, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
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
