const controlRepository = require("../repositories/controlRepository");
const riskRepository = require("../repositories/riskRepository");
const { ROLES } = require("../config/roles");
const { withResult, evaluateControlForUser } = require("../services/controlEvaluationService");
const { createControlForUser } = require("../services/controlCreationService");
const { updateCoreForUser } = require("../services/recordEditService");

const visibleControls = async (req) => {
  const controls = await controlRepository.getAll();
  if (req.user.role !== ROLES.AUDITOR) return controls;
  const assignedRiskIds = new Set((await riskRepository.getAll()).filter((risk) => risk.ownerId === req.user.id).map((risk) => risk.id));
  return controls.filter((control) => control.riskIds.some((id) => assignedRiskIds.has(id)));
};

const listControls = async (req, res) => res.json({ controls: (await visibleControls(req)).map(withResult) });

const createControl = async (req, res) => {
  try { return res.status(201).json({ control: await createControlForUser(req.user, req.body) }); }
  catch (error) {
    if ([400, 403, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};

const updateControl = async (req, res) => {
  try { return res.json({ control: withResult(await updateCoreForUser(req.user, "CONTROL", req.params.id, req.body)) }); }
  catch (error) {
    if ([400, 403, 404, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};

const evaluateControl = async (req, res) => {
  try { return res.json({ control: await evaluateControlForUser(req.user, req.params.id, req.body) }); }
  catch (error) { return res.status(error.status || 502).json({ message: error.status ? error.message : "No se pudo evaluar el control." }); }
};

module.exports = { listControls, createControl, updateControl, evaluateControl };
