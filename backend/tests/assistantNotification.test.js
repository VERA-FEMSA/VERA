const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-notification-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { parseChange } = require("../services/assistantNotificationService");

const options = (id, body) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify(body) });
const conversation = async (base, id) => {
  const response = await fetch(`${base}/api/assistant/conversations`, options(id, { focus: null }));
  assert.equal(response.status, 201);
  return `${base}/api/assistant/conversations/${(await response.json()).conversation.id}/ask`;
};
const ask = async (url, id, question) => (await (await fetch(url, options(id, { question }))).json()).message;
const makeProposal = async (base) => {
  const response = await fetch(`${base}/api/planning`, options(3, {
    title: `Aviso desde chat ${Date.now()}`, objective: "Revisar el proceso de compras.",
    scope: "Compras regionales.", justification: "El riesgo requiere revisión.",
    area: "Compras", year: 2026, quarter: "Q3"
  }));
  assert.equal(response.status, 201);
  return (await response.json()).proposal;
};

test("Las instrucciones de lectura exigen el ID exacto del aviso", () => {
  assert.deepEqual(parseChange("Marca leída la notificación PROPOSAL_REVIEW:AUD-1"),
    { read: true, id: "PROPOSAL_REVIEW:AUD-1" });
  assert.deepEqual(parseChange("Marca sin leer la notificación PROPOSAL_REVIEW:AUD-1"),
    { read: false, id: "PROPOSAL_REVIEW:AUD-1" });
  assert.equal(parseChange("Marca leída la notificación"), null);
});

test("Gerente consulta, previsualiza y marca su aviso; leerlo no decide la propuesta", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  const proposal = await makeProposal(base);
  const id = `PROPOSAL_REVIEW:${proposal.id}`;
  const url = await conversation(base, 3);
  assert.match((await ask(url, 3, "Avisos sin leer")).text, new RegExp(id));
  const preview = await ask(url, 3, `Marca leída la notificación ${id}`);
  assert.equal(preview.mode, "action-preview");
  assert.match(preview.text, /no completa ni modifica la tarea/i);
  const before = (await (await fetch(`${base}/api/notifications`, {
    headers: { Authorization: `Bearer ${jwt.sign({ id: 3 }, process.env.JWT_SECRET)}` }
  })).json()).notifications;
  assert.equal(before.find((item) => item.id === id).readAt, null);
  assert.equal((await ask(url, 3, "Confirmar lectura")).mode, "action-executed");
  const after = (await (await fetch(`${base}/api/notifications`, {
    headers: { Authorization: `Bearer ${jwt.sign({ id: 3 }, process.env.JWT_SECRET)}` }
  })).json()).notifications;
  assert.ok(after.find((item) => item.id === id).readAt);
  assert.equal(proposal.status, "OPEN");
  assert.equal((await ask(url, 3, "Confirmar lectura")).mode, "action-guidance");
  assert.equal((await ask(url, 3, `Marca sin leer la notificación ${id}`)).mode, "action-preview");
  assert.equal((await ask(url, 3, "Confirmar lectura")).mode, "action-executed");
});

test("Director solo consulta, los avisos ajenos se ocultan y un cambio externo invalida la vista previa", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  const proposal = await makeProposal(base);
  const id = `PROPOSAL_REVIEW:${proposal.id}`;
  const director = await conversation(base, 2);
  assert.doesNotMatch((await ask(director, 2, "Mis avisos")).text, new RegExp(id));
  assert.equal((await ask(director, 2, `Marca leída la notificación ${id}`)).mode, "action-guidance");
  const manager = await conversation(base, 3);
  assert.equal((await ask(manager, 3, `Marca leída la notificación ${id}`)).mode, "action-preview");
  const token = jwt.sign({ id: 3 }, process.env.JWT_SECRET);
  assert.equal((await fetch(`${base}/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PUT", headers: { Authorization: `Bearer ${token}` }
  })).status, 200);
  const stale = await ask(manager, 3, "Confirmar lectura");
  assert.equal(stale.mode, "action-guidance");
  assert.match(stale.text, /cambi[oó]/i);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(3,
    { question: `Marca sin leer la notificación ${id}` }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});
