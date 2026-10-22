const { randomUUID } = require("node:crypto");
const { createStore } = require("./supabaseDocumentStore");

const store = createStore("vera_actions");
const create = (data) => store.create({ ...data, id: `ACT-${randomUUID()}` }, {
  source_type: data.sourceType,
  source_id: data.sourceId,
  assignee_id: data.assigneeId,
  created_by_id: data.createdBy.id
});

const mutate = (id, changes, version) => store.mutate(id, changes, version,
  changes.assigneeId ? { assignee_id: changes.assigneeId } : {});

module.exports = { getAll: store.getAll, findById: store.findById, create, mutate };
