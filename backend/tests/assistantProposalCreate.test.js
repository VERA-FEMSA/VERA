const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-proposal-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const planningRepository = require("../repositories/planningRepository");
const { parseFields } = require("../services/assistantProposalCreateService");

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
const proposalFields = (title) => `Título: ${title}\nObjetivo: Revisar controles y accesos\nAlcance: Operaciones del trimestre\nJustificación: Verificar cumplimiento del programa\nÁrea: Operaciones\nTrimestre: Q4\nAño: 2026`;

test("Los campos conversacionales requieren etiquetas únicas y obligatorias", () => {
  assert.equal(parseFields(proposalFields("Prueba A")).fields.title, "Prueba A");
  assert.match(parseFields("Título: Prueba A").error, /Faltan campos/);
  assert.match(parseFields(`${proposalFields("Prueba A")}\nTítulo: Otra`).error, /sin repetirlos/);
  assert.match(parseFields(`${proposalFields("Prueba A")}\nClave: valor`).error, /Campos admitidos/);
});

test("Gerente crea propuesta con guía, vista previa, confirmación y sin duplicarla", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const url = await conversation(base, 3);
  const title = `Propuesta chat ${Date.now()}`;
  const before = (await planningRepository.getAll()).length;
  const guide = await ask(url, 3, "Crear propuesta");
  assert.match((await guide.json()).message.text, /Título:.*Objetivo:/s);
  const preview = await ask(url, 3, proposalFields(title));
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await planningRepository.getAll()).length, before);
  const confirmed = await ask(url, 3, "Confirmar propuesta");
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.equal(result.message.mode, "action-executed");
  assert.equal(result.historySaved, true);
  const created = await planningRepository.findById(result.message.actionOutcome.id);
  assert.equal(created.title, title);
  assert.equal(created.status, "OPEN");
  assert.equal(created.createdBy.id, 3);
  assert.equal((await planningRepository.getAll()).length, before + 1);
  assert.equal((await (await ask(url, 3, "Confirmar propuesta")).json()).message.mode,
    "action-guidance");
  assert.equal((await planningRepository.getAll()).length, before + 1);
});

test("Jefatura puede crear; Director no puede; entradas inválidas no escriben", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const before = (await planningRepository.getAll()).length;
  const deniedUrl = await conversation(base, 2);
  const denied = await ask(deniedUrl, 2, `Crear propuesta\n${proposalFields("Negada")}`);
  assert.match((await denied.json()).message.text, /no crearlas/);
  const url = await conversation(base, 4);
  const invalid = await ask(url, 4, `Crear propuesta\n${proposalFields("Invalida").replace("Año: 2026", "Año: 20xx")}`);
  assert.match((await invalid.json()).message.text, /año de cuatro dígitos/);
  const unknown = await ask(url, 4, `Crear propuesta\n${proposalFields("Invalida")}\nResponsable: Nadie`);
  assert.match((await unknown.json()).message.text, /Auditor activo/);
  assert.equal((await planningRepository.getAll()).length, before);
  const title = `Propuesta jefatura ${Date.now()}`;
  const preview = await ask(url, 4, `Crear propuesta\n${proposalFields(title)}\nResponsable: Auditor Demo`);
  assert.equal((await preview.json()).message.mode, "action-preview");
  const parallel = await Promise.all([ask(url, 4, "Confirmar propuesta"),
    ask(url, 4, "Confirmar propuesta")]);
  assert.ok(parallel.some((response) => response.status === 200));
  const matches = (await planningRepository.getAll()).filter((item) => item.title === title);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].responsibleId, 5);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(4,
    { question: `Crear propuesta\n${proposalFields("Efímera")}` }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});
