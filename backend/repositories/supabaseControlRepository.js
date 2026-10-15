const { randomUUID } = require("node:crypto");
const { createStore } = require("./supabaseDocumentStore");

const store = createStore("vera_controls");

const create = async (data) => {
  const createdAt = new Date().toISOString();
  const control = {
    ...data,
    id: `CTL-${randomUUID()}`,
    status: "ACTIVE",
    createdAt,
    updatedAt: null,
    evaluations: [{
      version: 1, rating: data.effectiveness, note: data.note,
      assessedAt: createdAt, assessedBy: { ...data.createdBy }
    }]
  };
  delete control.note;
  return store.create(control);
};

const update = (id, data, expectedVersion) => store.mutate(id, data, expectedVersion);
const evaluate = async (id, { rating, note, assessedBy }, expectedVersion) => {
  const current = await store.findById(id);
  if (!current) return null;
  const evaluation = {
    version: current.evaluations.length + 1, rating, note,
    assessedAt: new Date().toISOString(), assessedBy: { ...assessedBy }
  };
  return store.mutate(id, {
    effectiveness: rating,
    evaluations: [...current.evaluations, evaluation]
  }, expectedVersion ?? current.storageVersion);
};

module.exports = { getAll: store.getAll, findById: store.findById, create, update, evaluate };
