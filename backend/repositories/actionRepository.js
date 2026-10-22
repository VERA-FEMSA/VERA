const { randomUUID } = require("node:crypto");

const actions = [];
const clone = (action) => action ? {
  ...action,
  createdBy: { ...action.createdBy },
  history: action.history.map((entry) => ({ ...entry }))
} : null;

const getAll = () => actions.map(clone);
const findById = (id) => clone(actions.find((action) => action.id === id));
const create = (data) => {
  const action = { ...data, id: `ACT-${randomUUID()}`, storageVersion: 1 };
  actions.unshift(action);
  return clone(action);
};
const mutate = (id, changes, expectedVersion) => {
  const action = actions.find((item) => item.id === id);
  if (!action) return null;
  if (action.storageVersion !== expectedVersion) {
    const error = new Error("La acción cambió mientras la editabas. Actualiza y vuelve a intentar.");
    error.status = 409;
    throw error;
  }
  Object.assign(action, changes, { storageVersion: action.storageVersion + 1, updatedAt: new Date().toISOString() });
  return clone(action);
};

module.exports = process.env.VERA_EVIDENCE_COMMENT_STORE === "supabase"
  ? require("./supabaseActionRepository")
  : { getAll, findById, create, mutate };
