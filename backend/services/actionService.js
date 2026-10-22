const actionRepository = require("../repositories/actionRepository");
const planningRepository = require("../repositories/planningRepository");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const findingRepository = require("../repositories/findingRepository");
const userRepository = require("../repositories/userRepository");
const { logActivity } = require("./auditLogger");
const { USER_STATUS } = require("../config/accountRules");
const { ROLES, PLANNING_APPROVE_ROLES, RECORD_CREATE_ROLES } = require("../config/roles");

const SOURCES = ["AUDIT", "RISK", "CONTROL", "FINDING"];
const STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"];
const TRANSITIONS = {
  OPEN: ["IN_PROGRESS", "DONE", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "DONE", "CANCELLED"],
  DONE: ["OPEN"],
  CANCELLED: ["OPEN"]
};
const text = (value) => String(value ?? "").trim();

class ActionError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.action = true;
  }
}

const assertSourceInput = (sourceType, sourceId) => {
  if (typeof sourceType !== "string" || typeof sourceId !== "string" ||
      !SOURCES.includes(sourceType) || !sourceId.trim() || sourceId.length > 80) {
    throw new ActionError("Selecciona un registro de origen válido.", 400);
  }
};

// La misma regla de lectura se aplica al creador, al responsable y a cada consulta posterior.
const visibleSource = async (user, sourceType, sourceId) => {
  if (!Object.values(ROLES).includes(user.role)) return null;
  let source;
  if (sourceType === "AUDIT") {
    source = await planningRepository.findById(sourceId);
    if (user.role === ROLES.AUDITOR && source?.responsibleId !== user.id) return null;
  } else if (sourceType === "RISK") {
    source = await riskRepository.findById(sourceId);
    if (user.role === ROLES.AUDITOR && source?.ownerId !== user.id) return null;
  } else if (sourceType === "CONTROL") {
    source = await controlRepository.findById(sourceId);
    if (user.role === ROLES.AUDITOR && source) {
      const owned = (await riskRepository.getAll()).some((risk) => risk.ownerId === user.id && source.riskIds?.includes(risk.id));
      if (!owned) return null;
    }
  } else if (sourceType === "FINDING") {
    source = (await findingRepository.getAll()).find((item) => item.id === sourceId);
    if (user.role === ROLES.AUDITOR && source) {
      const risk = await riskRepository.findById(source.riskId);
      if (risk?.ownerId !== user.id) return null;
    }
  }
  return source || null;
};

const requiredSource = async (user, sourceType, sourceId) => {
  assertSourceInput(sourceType, sourceId);
  const source = await visibleSource(user, sourceType, sourceId);
  if (!source) throw new ActionError("El registro no existe o no está disponible para tu cuenta.", 404);
  return source;
};

const activeAssignee = async (id, sourceType, sourceId) => {
  const user = await userRepository.findById(id);
  if (!user || user.status !== USER_STATUS.ACTIVE || !RECORD_CREATE_ROLES.includes(user.role) ||
      !await visibleSource(user, sourceType, sourceId)) {
    throw new ActionError("Selecciona un responsable activo con acceso al registro.", 400);
  }
  return user;
};

const dateIsValid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

const listActions = async (user, { sourceType, sourceId } = {}) => {
  if (sourceType || sourceId) assertSourceInput(sourceType, sourceId);
  if (sourceType) await requiredSource(user, sourceType, sourceId);
  const actions = await actionRepository.getAll();
  if (sourceType) return actions.filter((action) => action.sourceType === sourceType && action.sourceId === sourceId);
  if (!Object.values(ROLES).includes(user.role)) return [];
  const [audits, risks, controls, findings] = await Promise.all([
    planningRepository.getAll(), riskRepository.getAll(), controlRepository.getAll(), findingRepository.getAll()
  ]);
  const visibleRisks = risks.filter((risk) => user.role !== ROLES.AUDITOR || risk.ownerId === user.id);
  const riskIds = new Set(visibleRisks.map((risk) => risk.id));
  const sourceIds = {
    AUDIT: new Set(audits.filter((audit) => user.role !== ROLES.AUDITOR || audit.responsibleId === user.id).map((audit) => audit.id)),
    RISK: riskIds,
    CONTROL: new Set(controls.filter((control) => user.role !== ROLES.AUDITOR || control.riskIds?.some((id) => riskIds.has(id))).map((control) => control.id)),
    FINDING: new Set(findings.filter((finding) => user.role !== ROLES.AUDITOR || riskIds.has(finding.riskId)).map((finding) => finding.id))
  };
  return actions.filter((action) => sourceIds[action.sourceType]?.has(action.sourceId));
};

const getAction = async (user, id) => {
  if (!id || id.length > 80) throw new ActionError("Selecciona una acción válida.", 400);
  const action = await actionRepository.findById(id);
  if (!action || !await visibleSource(user, action.sourceType, action.sourceId)) {
    throw new ActionError("La acción no existe o no está disponible para tu cuenta.", 404);
  }
  return action;
};

const listAssignees = async (user, sourceType, sourceId) => {
  await requiredSource(user, sourceType, sourceId);
  const people = (await userRepository.getAll()).filter((item) =>
    item.status === USER_STATUS.ACTIVE && RECORD_CREATE_ROLES.includes(item.role));
  const visible = [];
  for (const person of people) {
    if (await visibleSource(person, sourceType, sourceId)) {
      visible.push({ id: person.id, name: person.name, role: person.role });
    }
  }
  return visible;
};

const createAction = async (user, body) => {
  const sourceType = text(body.sourceType);
  const sourceId = text(body.sourceId);
  const source = await requiredSource(user, sourceType, sourceId);
  const title = text(body.title);
  const rationale = text(body.rationale);
  const dueDate = text(body.dueDate);
  const assigneeId = Number(body.assigneeId);
  if (title.length < 3 || title.length > 140) throw new ActionError("El título debe tener entre 3 y 140 caracteres.", 400);
  if (rationale.length < 10 || rationale.length > 1000) throw new ActionError("El motivo debe tener entre 10 y 1,000 caracteres.", 400);
  if (!dateIsValid(dueDate)) throw new ActionError("Indica una fecha objetivo válida (AAAA-MM-DD).", 400);
  if (!Number.isSafeInteger(assigneeId) || assigneeId < 1) throw new ActionError("Selecciona una persona responsable.", 400);
  const assignee = await activeAssignee(assigneeId, sourceType, sourceId);
  const now = new Date().toISOString();
  const action = await actionRepository.create({
    sourceType, sourceId, sourceTitle: source.title,
    title, rationale, dueDate, assigneeId, assigneeName: assignee.name,
    status: "OPEN", createdBy: { id: user.id, name: user.name || user.username },
    createdAt: now, updatedAt: now, completedAt: null,
    history: [{ type: "CREATED", actorId: user.id, at: now }]
  });
  await logActivity({ actor: user, action: "FOLLOW_UP_ACTION_CREATED", details: {
    actionId: action.id, sourceType, sourceId, assigneeId
  } });
  return action;
};

const assertVersion = (value) => {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) throw new ActionError("Actualiza la acción antes de cambiarla.", 400);
  return version;
};

const changeStatus = async (user, id, body) => {
  const action = await getAction(user, id);
  if (action.assigneeId !== user.id && !PLANNING_APPROVE_ROLES.includes(user.role)) {
    throw new ActionError("Solo el responsable o quien dirige la planeación puede cambiar el estado.", 403);
  }
  const status = text(body.status);
  const note = text(body.note);
  if (!STATUSES.includes(status) || !TRANSITIONS[action.status]?.includes(status)) {
    throw new ActionError("La transición de estado no está permitida.", 409);
  }
  if (note.length < 10 || note.length > 1000) throw new ActionError("Explica el cambio en 10 a 1,000 caracteres.", 400);
  const now = new Date().toISOString();
  const updated = await actionRepository.mutate(id, {
    status, completedAt: ["DONE", "CANCELLED"].includes(status) ? now : null,
    history: [...action.history, { type: "STATUS_CHANGED", from: action.status, to: status, note, actorId: user.id, at: now }]
  }, assertVersion(body.version));
  await logActivity({ actor: user, action: "FOLLOW_UP_ACTION_STATUS_CHANGED", details: {
    actionId: id, sourceType: action.sourceType, sourceId: action.sourceId, from: action.status, to: status
  } });
  return updated;
};

const reassign = async (user, id, body) => {
  const action = await getAction(user, id);
  const assigneeId = Number(body.assigneeId);
  const note = text(body.note);
  if (!Number.isSafeInteger(assigneeId) || assigneeId < 1) throw new ActionError("Selecciona una persona responsable.", 400);
  if (assigneeId === action.assigneeId) throw new ActionError("La acción ya tiene esa persona responsable.", 409);
  if (note.length < 10 || note.length > 1000) throw new ActionError("Explica el cambio en 10 a 1,000 caracteres.", 400);
  const assignee = await activeAssignee(assigneeId, action.sourceType, action.sourceId);
  const now = new Date().toISOString();
  const updated = await actionRepository.mutate(id, {
    assigneeId, assigneeName: assignee.name,
    history: [...action.history, { type: "REASSIGNED", fromId: action.assigneeId, toId: assigneeId, note, actorId: user.id, at: now }]
  }, assertVersion(body.version));
  await logActivity({ actor: user, action: "FOLLOW_UP_ACTION_REASSIGNED", details: {
    actionId: id, sourceType: action.sourceType, sourceId: action.sourceId, fromId: action.assigneeId, toId: assigneeId
  } });
  return updated;
};

module.exports = { ActionError, listActions, getAction, listAssignees, createAction, changeStatus, reassign };
