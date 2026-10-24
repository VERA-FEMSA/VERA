const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-risk-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const riskRepository = require("../repositories/riskRepository");
const { parseRiskCommand } = require("../services/assistantRiskEvaluationService");

const post = (id, body) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify(body) });
const createRisk = async (base, title) => {
  const response = await fetch(`${base}/api/risks`, post(3, { title,
    description: "Exposición de prueba con impacto en varios procesos.", area: "Operaciones",
    ownerId: 5, likelihood: 1, impact: 1, note: "La valoración inicial documenta la exposición." }));
  assert.equal(response.status, 201);
  return (await response.json()).risk;
};
const conversation = async (base, id) => {
  const created = await fetch(`${base}/api/assistant/conversations`, post(id, { focus: null }));
  assert.equal(created.status, 201);
  return `${base}/api/assistant/conversations/${(await created.json()).conversation.id}/ask`;
};
const ask = (url, id, question) => fetch(url, post(id, { question }));
const conversationsEnabled = (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
};

test("La instrucción de evaluación exige un riesgo exacto, dos factores y motivo", () => {
  assert.deepEqual(parseRiskCommand("Evalúa el riesgo «Acceso indebido» con probabilidad 3 e impacto 2 porque faltan revisiones."),
    { target: "Acceso indebido", likelihood: 3, impact: 2, note: "faltan revisiones." });
  assert.equal(parseRiskCommand("Evalúa todos los riesgos"), null);
});

test("El chat evalúa tras confirmar, conserva historial y evita repetir la confirmación", async (t) => {
  conversationsEnabled(t);
  const base = await startTestServer(t, app);
  const risk = await createRisk(base, `Evaluación chat ${Date.now()}`);
  const url = await conversation(base, 3);
  const command = `Evalúa el riesgo ${risk.id} con probabilidad 3 e impacto 2 porque la exposición afecta varios procesos.`;
  const preview = await ask(url, 3, command);
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await riskRepository.findById(risk.id)).evaluations.length, 1);
  const confirmed = await ask(url, 3, "Confirmar evaluación");
  assert.equal(confirmed.status, 200, JSON.stringify(await confirmed.clone().json()));
  assert.equal((await confirmed.json()).message.mode, "action-executed");
  const updated = await riskRepository.findById(risk.id);
  assert.equal(updated.evaluations.length, 2);
  assert.equal(updated.score, 6);
  assert.equal(updated.evaluations[1].assessedBy.id, 3);
  assert.equal((await (await ask(url, 3, "Confirmar evaluación")).json()).message.mode, "action-guidance");
  assert.equal((await riskRepository.findById(risk.id)).evaluations.length, 2);
});

test("La vista previa se invalida si el riesgo cambia y el rol sin permiso no puede evaluar", async (t) => {
  conversationsEnabled(t);
  const base = await startTestServer(t, app);
  const risk = await createRisk(base, `Cambio chat ${Date.now()}`);
  const command = `Evalúa el riesgo ${risk.id} con probabilidad 3 e impacto 2 porque la exposición afecta varios procesos.`;
  const denied = await conversation(base, 2);
  assert.equal((await (await ask(denied, 2, command)).json()).message.mode, "action-guidance");
  const url = await conversation(base, 3);
  assert.equal((await (await ask(url, 3, command)).json()).message.mode, "action-preview");
  const direct = await fetch(`${base}/api/risks/${risk.id}/evaluate`, post(3, {
    likelihood: 2, impact: 2, note: "Cambió la valoración antes de confirmar el chat." }));
  assert.equal(direct.status, 200);
  const stale = await ask(url, 3, "Confirmar evaluación");
  assert.equal((await stale.json()).message.mode, "action-guidance");
  assert.equal((await riskRepository.findById(risk.id)).evaluations.length, 2);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, post(3, { question: command }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});
