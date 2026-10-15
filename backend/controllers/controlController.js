const controlRepository = require("../repositories/controlRepository");
const riskRepository = require("../repositories/riskRepository");
const userRepository = require("../repositories/userRepository");
const { logActivity } = require("../services/auditLogger");
const { USER_STATUS } = require("../config/accountRules");
const { ROLES } = require("../config/roles");

const TYPES = ["PREVENTIVE", "DETECTIVE", "CORRECTIVE"];
const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "Annually"];
const text = (value) => String(value ?? "").trim();
const activeUsers = async () => (await userRepository.getAll()).filter((user) => user.status === USER_STATUS.ACTIVE);

const parseCore = async (body) => {
  const title = text(body.title);
  const description = text(body.description);
  const type = text(body.type);
  const frequency = text(body.frequency);
  const owner = (await activeUsers()).find((user) => user.id === Number(body.ownerId));
  const rawRiskIds = Array.isArray(body.riskIds) ? [...new Set(body.riskIds.map((id) => text(id)).filter(Boolean))] : [];
  const risks = await riskRepository.getAll();

  if (title.length < 3 || title.length > 120) return { error: "El nombre debe tener entre 3 y 120 caracteres." };
  if (description.length < 10 || description.length > 1000) return { error: "La descripción debe tener entre 10 y 1,000 caracteres." };
  if (!TYPES.includes(type)) return { error: "Selecciona un tipo de control válido." };
  if (!FREQUENCIES.includes(frequency)) return { error: "Selecciona una frecuencia válida." };
  if (!owner) return { error: "Selecciona una persona responsable con cuenta activa." };
  if (rawRiskIds.length === 0 || rawRiskIds.some((id) => !risks.some((risk) => risk.id === id))) {
    return { error: "Relaciona el control con al menos un riesgo existente." };
  }
  return { data: { title, description, type, frequency, ownerId: owner.id, ownerName: owner.name, riskIds: rawRiskIds } };
};

const parseEvaluation = (body) => {
  const rating = Number(body.rating);
  const note = text(body.note);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "La efectividad debe ser un valor entero del 1 al 5." };
  if (note.length < 10 || note.length > 500) return { error: "La justificación debe tener entre 10 y 500 caracteres." };
  return { data: { rating, note } };
};

const visibleControls = async (req) => {
  const controls = await controlRepository.getAll();
  if (req.user.role !== ROLES.AUDITOR) return controls;
  const assignedRiskIds = new Set((await riskRepository.getAll()).filter((risk) => risk.ownerId === req.user.id).map((risk) => risk.id));
  return controls.filter((control) => control.riskIds.some((id) => assignedRiskIds.has(id)));
};

const listControls = async (req, res) => res.json({ controls: await visibleControls(req) });

const createControl = async (req, res) => {
  const core = await parseCore(req.body);
  if (core.error) return res.status(400).json({ message: core.error });
  const evaluation = parseEvaluation(req.body);
  if (evaluation.error) return res.status(400).json({ message: evaluation.error });
  const control = await controlRepository.create({
    ...core.data,
    effectiveness: evaluation.data.rating,
    note: evaluation.data.note,
    createdBy: { id: req.user.id, username: req.user.username, role: req.user.role }
  });
  logActivity({ actor: req.user, action: "CONTROL_REGISTERED", details: { controlId: control.id, title: control.title, riskIds: control.riskIds } });
  return res.status(201).json({ control });
};

const updateControl = async (req, res) => {
  const current = await controlRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Control no encontrado." });
  const core = await parseCore(req.body);
  if (core.error) return res.status(400).json({ message: core.error });
  const control = await controlRepository.update(current.id, core.data, current.storageVersion);
  logActivity({ actor: req.user, action: "CONTROL_UPDATED", details: { controlId: control.id, title: control.title } });
  return res.json({ control });
};

const evaluateControl = async (req, res) => {
  const current = await controlRepository.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Control no encontrado." });
  const evaluation = parseEvaluation(req.body);
  if (evaluation.error) return res.status(400).json({ message: evaluation.error });
  const control = await controlRepository.evaluate(current.id, {
    ...evaluation.data,
    assessedBy: { id: req.user.id, username: req.user.username, role: req.user.role }
  }, current.storageVersion);
  logActivity({ actor: req.user, action: "CONTROL_EVALUATED", details: { controlId: control.id, title: control.title, rating: control.effectiveness, version: control.evaluations.length } });
  return res.json({ control });
};

module.exports = { listControls, createControl, updateControl, evaluateControl };
