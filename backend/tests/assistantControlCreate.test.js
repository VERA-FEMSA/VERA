const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-control-create-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const { parseFields } = require("../services/assistantControlCreateService");

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
const fields = (title, risk) => `Título: ${title}\nDescripción: Se revisan los accesos de todos los usuarios cada mes\nTipo: Preventivo\nFrecuencia: Mensual\nRiesgos: ${risk}\nEfectividad: 4\nJustificación: La revisión cubre los accesos del periodo`;
const createRisk = (title) => riskRepository.create({ title, description: "Riesgo vinculado a control chat",
  area: "Operaciones", ownerId: 3, ownerName: "Gerente de prueba", responsePlan: "",
  linkedAuditId: null, likelihood: 2, impact: 3, score: 6, level: "Alto",
  note: "Se documenta evaluación inicial del riesgo.", createdBy: { id: 3, name: "gerente" } });

test("El formulario de control exige campos etiquetados y únicos", () => {
  assert.equal(parseFields(fields("Revisión A", "RSK-001")).fields.type, "Preventivo");
  assert.match(parseFields("Título: Revisión A").error, /Faltan campos/);
  assert.match(parseFields(`${fields("Revisión A", "RSK-001")}\nTítulo: Otra`).error, /sin repetirlos/);
});

test("Gerente crea control con evaluación inicial tras confirmación", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const risk = createRisk(`Riesgo control ${Date.now()}`);
  const url = await conversation(base, 3);
  const title = `Control chat ${Date.now()}`;
  const before = (await controlRepository.getAll()).length;
  assert.match((await (await ask(url, 3, "Registrar control")).json()).message.text, /Efectividad:/);
  const preview = await ask(url, 3, fields(title, risk.id));
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await controlRepository.getAll()).length, before);
  const confirmed = await ask(url, 3, "Confirmar control nuevo");
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.equal(result.message.mode, "action-executed");
  assert.equal(result.historySaved, true);
  const control = await controlRepository.findById(result.message.actionOutcome.id);
  assert.equal(control.title, title);
  assert.equal(control.type, "PREVENTIVE");
  assert.equal(control.frequency, "Monthly");
  assert.equal(control.ownerId, 3);
  assert.deepEqual(control.riskIds, [risk.id]);
  assert.equal(control.evaluations.length, 1);
  assert.equal((await (await ask(url, 3, "Confirmar control nuevo")).json()).message.mode,
    "action-guidance");
  assert.equal((await controlRepository.getAll()).length, before + 1);
});

test("Rol, riesgos ambiguos y valores inválidos no escriben; confirmación repetida crea una vez", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const risk = createRisk(`Riesgo control paralelo ${Date.now()}`);
  const deniedUrl = await conversation(base, 2);
  assert.match((await (await ask(deniedUrl, 2, `Registrar control\n${fields("Negado", risk.id)}`)).json()).message.text,
    /no registrarlos/);
  const url = await conversation(base, 1);
  const before = (await controlRepository.getAll()).length;
  assert.match((await (await ask(url, 1, `Registrar control\n${fields("Inválido", risk.id).replace("Efectividad: 4", "Efectividad: 9")}`)).json()).message.text,
    /de 1 a 5/);
  assert.match((await (await ask(url, 1, `Registrar control\n${fields("Inválido", "RSK-NO-EXISTE")}`)).json()).message.text,
    /no existe/);
  assert.equal((await controlRepository.getAll()).length, before);
  const title = `Control concurrente ${Date.now()}`;
  assert.equal((await (await ask(url, 1, `Registrar control\n${fields(title, risk.id)}\nResponsable: Auditor Demo`)).json()).message.mode,
    "action-preview");
  const parallel = await Promise.all([ask(url, 1, "Confirmar control nuevo"),
    ask(url, 1, "Confirmar control nuevo")]);
  assert.ok(parallel.some((response) => response.status === 200));
  const matches = (await controlRepository.getAll()).filter((item) => item.title === title);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].ownerId, 5);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(1,
    { question: `Registrar control\n${fields("Efímero", risk.id)}` }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});
