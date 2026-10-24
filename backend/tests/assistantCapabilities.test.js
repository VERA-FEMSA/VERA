const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-capabilities-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { isCapabilityQuestion, capabilityAnswer } = require("../services/assistantCapabilityService");

const post = (id, body) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify(body) });

test("La ayuda reconoce preguntas habituales sin interpretar acciones como ayuda", () => {
  assert.equal(isCapabilityQuestion("¿Qué puedes hacer aquí?"), true);
  assert.equal(isCapabilityQuestion("Ayuda"), true);
  assert.equal(isCapabilityQuestion("Muéstrame las opciones del chat"), true);
  assert.equal(isCapabilityQuestion("Aprueba la propuesta X"), false);
});

test("La respuesta de capacidades respeta el rol y el tipo de conversación", () => {
  const director = capabilityAnswer({ role: "DIRECTOR" }, true);
  assert.doesNotMatch(director, /aprobar o rechazar|evaluar riesgos/i);
  const manager = capabilityAnswer({ role: "GERENTE" }, true);
  assert.match(manager, /aprobar o rechazar/i);
  assert.match(manager, /evaluar riesgos/i);
  assert.match(manager, /registrar una referencia de evidencia/i);
  assert.doesNotMatch(director, /registrar una referencia de evidencia/i);
  const ephemeral = capabilityAnswer({ role: "GERENTE" }, false);
  assert.doesNotMatch(ephemeral, /aprobar o rechazar/i);
  assert.match(ephemeral, /sólo lee/);
});

test("La API devuelve capacidades permitidas aun sin Azure y guarda la respuesta en el chat", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const simple = await fetch(`${base}/api/assistant/ask`, post(2, { question: "¿Qué puedes hacer aquí?" }));
  assert.equal(simple.status, 200);
  assert.doesNotMatch((await simple.json()).answer, /aprobar o rechazar/i);
  const created = await fetch(`${base}/api/assistant/conversations`, post(3, { focus: null }));
  assert.equal(created.status, 201);
  const id = (await created.json()).conversation.id;
  const guided = await fetch(`${base}/api/assistant/conversations/${id}/ask`, post(3, { question: "¿Qué puedo hacer con VERA?" }));
  assert.equal(guided.status, 200);
  const body = await guided.json();
  assert.equal(body.message.mode, "action-guidance");
  assert.match(body.message.text, /evaluar riesgos/i);
});
