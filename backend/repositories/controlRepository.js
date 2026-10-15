const controls = [];

const clone = (control) => ({
  ...control,
  riskIds: [...control.riskIds],
  evaluations: control.evaluations.map((item) => ({ ...item, assessedBy: { ...item.assessedBy } }))
});

const getAll = () => controls.map(clone);
const findById = (id) => controls.find((control) => control.id === id) || null;
const nextId = () => {
  const last = controls.reduce((highest, control) => Math.max(highest, Number(control.id.replace("CTL-", "")) || 0), 0);
  return `CTL-${String(last + 1).padStart(3, "0")}`;
};

const create = (data) => {
  const createdAt = new Date().toISOString();
  const control = {
    ...data,
    id: nextId(),
    status: "ACTIVE",
    createdAt,
    updatedAt: null,
    evaluations: [{ version: 1, rating: data.effectiveness, note: data.note, assessedAt: createdAt, assessedBy: { ...data.createdBy } }]
  };
  delete control.note;
  controls.unshift(control);
  return clone(control);
};

const update = (id, data) => {
  const control = findById(id);
  if (!control) return null;
  Object.assign(control, data, { updatedAt: new Date().toISOString() });
  return clone(control);
};

const evaluate = (id, { rating, note, assessedBy }) => {
  const control = findById(id);
  if (!control) return null;
  const evaluation = { version: control.evaluations.length + 1, rating, note, assessedAt: new Date().toISOString(), assessedBy: { ...assessedBy } };
  control.effectiveness = rating;
  control.updatedAt = evaluation.assessedAt;
  control.evaluations.push(evaluation);
  return clone(control);
};

const memoryRepository = { getAll, findById, create, update, evaluate };
module.exports = process.env.VERA_RISK_CONTROL_STORE === "supabase"
  ? require("./supabaseControlRepository")
  : memoryRepository;
