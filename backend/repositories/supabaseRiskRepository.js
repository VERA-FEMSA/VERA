const { randomUUID } = require("node:crypto");
const { createStore } = require("./supabaseDocumentStore");

const store = createStore("vera_risks");
const normalize = (value) => String(value ?? "").trim().toLowerCase();

const findDuplicate = async ({ title, area }, excludeId = null) =>
  (await store.getAll()).find((risk) => risk.id !== excludeId &&
    normalize(risk.title) === normalize(title) && normalize(risk.area) === normalize(area)) || null;

const create = async (data) => {
  const assessedAt = new Date().toISOString();
  const risk = {
    ...data,
    id: `RSK-${randomUUID()}`,
    status: "OPEN",
    createdAt: assessedAt,
    updatedAt: null,
    createdBy: { ...data.createdBy },
    evaluations: [{
      version: 1, likelihood: data.likelihood, impact: data.impact,
      score: data.score, level: data.level, note: data.note,
      assessedAt, assessedBy: { ...data.createdBy }
    }]
  };
  delete risk.assessmentNote;
  return store.create(risk);
};

const update = (id, data, expectedVersion) => store.mutate(id, data, expectedVersion);
const evaluate = async (id, { likelihood, impact, score, level, note, assessedBy }, expectedVersion) => {
  const current = await store.findById(id);
  if (!current) return null;
  const assessedAt = new Date().toISOString();
  const evaluation = {
    version: current.evaluations.length + 1,
    likelihood, impact, score, level, note, assessedAt, assessedBy: { ...assessedBy }
  };
  return store.mutate(id, {
    likelihood, impact, score, level,
    evaluations: [...current.evaluations, evaluation]
  }, expectedVersion ?? current.storageVersion);
};

module.exports = {
  getAll: store.getAll, findById: store.findById, findDuplicate, create, update, evaluate
};
