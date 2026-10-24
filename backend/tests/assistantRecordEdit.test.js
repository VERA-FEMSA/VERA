const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-record-edit-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const { parseCommand } = require("../services/assistantRecordEditService");
const { updateSingleFieldForUser } = require("../services/recordEditService");

const options = (id, body) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify(body) });
const conversation = async (base, id) => {
  const response = await fetch(`${base}/api/assistant/conversations`, options(id, { focus: null }));
  assert.equal(response.status, 201);
  return `${base}/api/assistant/conversations/${(await response.json()).conversation.id}/ask`;
};
const ask = (url, id, question) => fetch(url, options(id, { question }));
const risk = () => riskRepository.create({ title: `Riesgo edición ${Date.now()}`,
  description: "Descripción inicial del riesgo en el proceso", area: "Operaciones",
  ownerId: 3, ownerName: "Gerente de prueba", responsePlan: "", linkedAuditId: null,
  likelihood: 2, impact: 3, score: 6, level: "Alto", note: "Evaluación inicial documentada",
  createdBy: { id: 3, name: "gerente" } });
const control = (riskId) => controlRepository.create({ title: `Control edición ${Date.now()}`,
  description: "Descripción inicial del control de accesos", type: "PREVENTIVE",
  frequency: "Monthly", ownerId: 3, ownerName: "Gerente de prueba", riskIds: [riskId],
  effectiveness: 4, note: "Evaluación inicial documentada", createdBy: { id: 3, name: "gerente" } });

test("La instrucción exige ID, campo, valor delimitado y motivo", () => {
  const parsed = parseCommand("Edita el riesgo RSK-001: nombre = «Nuevo título» porque cambió el alcance del proceso.");
  assert.equal(parsed.type, "RISK");
  assert.equal(parsed.field, "title");
  assert.equal(parseCommand("Edita el riesgo RSK-001: nombre = Nuevo título"), null);
});

test("Gerente edita riesgo y control con vista previa, motivo y sin alterar evaluaciones", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  const record = risk();
  const linked = control(record.id);
  const url = await conversation(base, 3);
  const newArea = "Finanzas";
  const riskPreview = await ask(url, 3,
    `Edita el riesgo ${record.id}: área = «${newArea}» porque el proceso ahora depende de Finanzas.`);
  assert.equal((await riskPreview.json()).message.mode, "action-preview");
  assert.equal((await riskRepository.findById(record.id)).area, "Operaciones");
  const riskDone = await ask(url, 3, "Confirmar edición de registro");
  assert.equal((await riskDone.json()).message.mode, "action-executed");
  assert.equal((await riskRepository.findById(record.id)).area, newArea);
  assert.equal((await riskRepository.findById(record.id)).evaluations.length, 1);
  const controlPreview = await ask(url, 3,
    `Edita el control ${linked.id}: frecuencia = «Quarterly» porque el calendario de revisión cambió.`);
  assert.equal((await controlPreview.json()).message.mode, "action-preview");
  const controlDone = await ask(url, 3, "Confirmar edición de registro");
  assert.equal((await controlDone.json()).message.mode, "action-executed");
  assert.equal((await controlRepository.findById(linked.id)).frequency, "Quarterly");
  assert.equal((await controlRepository.findById(linked.id)).evaluations.length, 1);
  assert.equal((await (await ask(url, 3, "Confirmar edición de registro")).json()).message.mode, "action-guidance");
});

test("Director no edita y un cambio concurrente invalida la vista previa", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  const record = risk();
  const denied = await conversation(base, 2);
  const command = `Edita el riesgo ${record.id}: nombre = «Riesgo actualizado» porque se corrigió el alcance del proceso.`;
  assert.equal((await (await ask(denied, 2, command)).json()).message.mode, "action-guidance");
  const manager = await conversation(base, 3);
  assert.equal((await (await ask(manager, 3, command)).json()).message.mode, "action-preview");
  riskRepository.update(record.id, { description: "Cambio concurrente documentado en la descripción" });
  const stale = await ask(manager, 3, "Confirmar edición de registro");
  assert.equal((await stale.json()).message.mode, "action-guidance");
  assert.equal((await riskRepository.findById(record.id)).title, record.title);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(3, { question: command }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});

test("Un mismo identificador de operación no aplica dos veces una edición", async () => {
  const record = risk();
  const operationId = "0ec87c76-4cbf-4b1d-aeee-44ac12b04e01";
  const expected = { value: record.title, updatedAt: record.updatedAt };
  const first = await updateSingleFieldForUser({ id: 3, role: "GERENTE" }, "RISK", record.id,
    "title", "Nombre nuevo del riesgo", "Se corrigió el nombre del expediente.", expected, operationId);
  const second = await updateSingleFieldForUser({ id: 3, role: "GERENTE" }, "RISK", record.id,
    "title", "Nombre nuevo del riesgo", "Se corrigió el nombre del expediente.", expected, operationId);
  assert.equal(first.id, second.id);
  assert.equal(second.title, "Nombre nuevo del riesgo");
});
