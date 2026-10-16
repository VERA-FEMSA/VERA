const { randomUUID } = require("node:crypto");
const { createStore } = require("./supabaseDocumentStore");

const store = createStore("vera_evidence");
const create = (data) => store.create({
  ...data,
  id: `EVD-${randomUUID()}`,
  createdAt: new Date().toISOString(),
  author: { ...data.author }
}, { entity_type: data.entityType, entity_id: data.entityId });

module.exports = { getAll: store.getAll, create };
