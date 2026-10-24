const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-audit-edit-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const planningRepository = require("../repositories/planningRepository");
const { parseCommand } = require("../services/assistantAuditEditService");
const { editAuditForUser } = require("../services/auditEditService");

const options = (id, method, body) => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body ? { "Content-Type": "application/json" } : {})
}, ...(body ? { body: JSON.stringify(body) } : {}) });
const conversation = async (base, id) => {
  const response = await fetch(`${base}/api/assistant/conversations`, options(id, "POST", { focus: null }));
  assert.equal(response.status, 201);
  return `${base}/api/assistant/conversations/${(await response.json()).conversation.id}/ask`;
};
const ask = async (url, id, question) => (await (await fetch(url, options(id, "POST", { question }))).json()).message;
const createApproved = async (base) => {
  const created = await fetch(`${base}/api/planning`, options(3, "POST", {
    title: `Auditoría editable ${Date.now()} ${Math.random()}`,
    objective: "Revisar los controles del proceso de compras.", scope: "Compras regionales.",
    justification: "La revisión es necesaria por riesgo operativo.", area: "Compras",
    startDate: "2026-10-01", endDate: "2026-10-31", year: 2026
  }));
  assert.equal(created.status, 201);
  const id = (await created.json()).proposal.id;
  assert.equal((await fetch(`${base}/api/planning/${id}/approve`, options(3, "POST", { quarter: "Q4" }))).status, 200);
  return id;
};

test("La instrucción requiere ID, campo, valor delimitado y motivo", () => {
  assert.deepEqual(parseCommand("Edita la auditoría AUD-01: objetivo = «Nuevo objetivo» porque cambió la revisión."),
    { id: "AUD-01", field: "objective", value: "Nuevo objetivo", reason: "cambió la revisión." });
  assert.equal(parseCommand("Edita la auditoría AUD-01: objetivo = Nuevo objetivo"), null);
});

test("Gerente edita una auditoría aprobada desde el chat y conserva su estado", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  const id = await createApproved(base);
  const url = await conversation(base, 3);
  const instruction = `Edita la auditoría ${id}: objetivo = «Revisar controles de compras y pagos.» porque el alcance aprobado ahora incluye pagos.`;
  const preview = await ask(url, 3, instruction);
  assert.equal(preview.mode, "action-preview");
  assert.equal((await planningRepository.findById(id)).objective, "Revisar los controles del proceso de compras.");
  assert.equal((await ask(url, 3, "Confirmar edición de auditoría")).mode, "action-executed");
  const current = await planningRepository.findById(id);
  assert.equal(current.objective, "Revisar controles de compras y pagos.");
  assert.equal(current.status, "APPROVED");
  assert.equal((await ask(url, 3, "Confirmar edición de auditoría")).mode, "action-guidance");
  const history = await (await fetch(`${base}/api/planning/${id}/history`, options(3, "GET"))).json();
  assert.ok(history.history.some((entry) => entry.action === "AUDIT_UPDATED" &&
    entry.details.reason === "el alcance aprobado ahora incluye pagos."));
});

test("Director no edita, el estado limita los campos y un cambio externo invalida la vista previa", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  const id = await createApproved(base);
  const director = await conversation(base, 2);
  const command = `Edita la auditoría ${id}: objetivo = «Otro objetivo aprobado» porque cambió el alcance del equipo.`;
  assert.equal((await ask(director, 2, command)).mode, "action-guidance");
  const manager = await conversation(base, 3);
  assert.equal((await ask(manager, 3, `Edita la auditoría ${id}: título = «No permitido» porque cambió el plan de auditoría.`)).mode, "action-guidance");
  assert.equal((await ask(manager, 3, command)).mode, "action-preview");
  assert.equal((await fetch(`${base}/api/planning/${id}/details`, options(3, "PATCH",
    { objective: "Cambio externo documentado en el formulario." }))).status, 200);
  const stale = await ask(manager, 3, "Confirmar edición de auditoría");
  assert.equal(stale.mode, "action-guidance");
  assert.match(stale.text, /cambi[oó]/i);
  assert.equal((await planningRepository.findById(id)).objective, "Cambio externo documentado en el formulario.");
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(3, "POST", { question: command }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});

test("El mismo ID de operación no registra dos ediciones", async (context) => {
  const base = await startTestServer(context, app);
  const id = await createApproved(base);
  const current = await planningRepository.findById(id);
  const operationId = "42e7ad95-a989-40a7-9011-9678c04f5d33";
  const optionsForEdit = { operationId, reason: "Se amplió la revisión de compras.",
    expected: { storageVersion: current.storageVersion, updatedAt: current.updatedAt,
      status: current.status, field: "objective", value: current.objective } };
  const first = await editAuditForUser({ id: 3, role: "GERENTE" }, id,
    { objective: "Objetivo actualizado de la revisión." }, optionsForEdit);
  const second = await editAuditForUser({ id: 3, role: "GERENTE" }, id,
    { objective: "Objetivo actualizado de la revisión." }, optionsForEdit);
  assert.equal(first.audit.id, second.audit.id);
  assert.equal(second.audit.objective, "Objetivo actualizado de la revisión.");
});
