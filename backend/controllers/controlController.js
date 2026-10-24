const controlRepository = require("../repositories/controlRepository");
const riskRepository = require("../repositories/riskRepository");
const { logActivity } = require("../services/auditLogger");
const { ROLES } = require("../config/roles");
const { withResult, evaluateControlForUser } = require("../services/controlEvaluationService");
const { parseCore, createControlForUser } = require("../services/controlCreationService");

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
  const current = await controlRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Control no encontrado." });
  const core = await parseCore(req.body);
  if (core.error) return res.status(400).json({ message: core.error });
  const control = await controlRepository.update(current.id, core.data, current.storageVersion);
  await logActivity({ actor: req.user, action: "CONTROL_UPDATED", details: { controlId: control.id, title: control.title } });
  return res.json({ control: withResult(control) });
};

const evaluateControl = async (req, res) => {
  try { return res.json({ control: await evaluateControlForUser(req.user, req.params.id, req.body) }); }
  catch (error) { return res.status(error.status || 502).json({ message: error.status ? error.message : "No se pudo evaluar el control." }); }
};

module.exports = { listControls, createControl, updateControl, evaluateControl };
