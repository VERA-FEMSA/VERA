const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-risk-create-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const riskRepository = require("../repositories/riskRepository");
const { parseFields } = require("../services/assistantRiskCreateService");

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
const fields = (title) => `Título: ${title}\nDescripción: Hay permisos sin revisión y posible acceso indebido\nÁrea: Operaciones\nProbabilidad: 2\nImpacto: 3\nJustificación: Se observaron cuentas sin revisión durante el trimestre`;

test("Registrar riesgo exige campos explícitos y sin duplicados", () => {
  assert.equal(parseFields(fields("Riesgo A")).fields.title, "Riesgo A");
  assert.match(parseFields("Título: Riesgo A").error, /Faltan campos/);
  assert.match(parseFields(`${fields("Riesgo A")}\nTítulo: Otro`).error, /sin repetirlos/);
});

test("Gerente registra riesgo con confirmación y conserva evaluación inicial", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const url = await conversation(base, 3);
  const title = `Riesgo chat ${Date.now()}`;
  const before = (await riskRepository.getAll()).length;
  assert.match((await (await ask(url, 3, "Registrar riesgo")).json()).message.text, /Probabilidad:/);
  const preview = await ask(url, 3, fields(title));
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await riskRepository.getAll()).length, before);
  const confirmed = await ask(url, 3, "Confirmar riesgo");
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.equal(result.message.mode, "action-executed");
  assert.equal(result.historySaved, true);
  const risk = await riskRepository.findById(result.message.actionOutcome.id);
  assert.equal(risk.title, title);
  assert.equal(risk.ownerId, 3);
  assert.equal(risk.level, "Alto");
  assert.equal(risk.score, 6);
  assert.equal(risk.evaluations.length, 1);
  assert.equal((await riskRepository.getAll()).length, before + 1);
  assert.equal((await (await ask(url, 3, "Confirmar riesgo")).json()).message.mode, "action-guidance");
});

test("Permisos y datos inválidos impiden escrituras; dos confirmaciones crean una vez", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const deniedUrl = await conversation(base, 2);
  assert.match((await (await ask(deniedUrl, 2, `Registrar riesgo\n${fields("Negado")}`)).json()).message.text,
    /no registrarlos/);
  const url = await conversation(base, 1);
  const before = (await riskRepository.getAll()).length;
  assert.match((await (await ask(url, 1, `Registrar riesgo\n${fields("Inválido").replace("Impacto: 3", "Impacto: 9")}`)).json()).message.text,
    /de 1 a 3/);
  assert.match((await (await ask(url, 1, `Registrar riesgo\n${fields("Inválido")}\nResponsable: Nadie`)).json()).message.text,
    /cuenta activa/);
  assert.equal((await riskRepository.getAll()).length, before);
  const title = `Riesgo concurrente ${Date.now()}`;
  assert.equal((await (await ask(url, 1, `Registrar riesgo\n${fields(title)}\nResponsable: Auditor Demo\nAuditoría: AUD-01`)).json()).message.mode,
    "action-preview");
  const parallel = await Promise.all([ask(url, 1, "Confirmar riesgo"), ask(url, 1, "Confirmar riesgo")]);
  assert.ok(parallel.some((response) => response.status === 200));
  const matches = (await riskRepository.getAll()).filter((item) => item.title === title);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].ownerId, 5);
  assert.equal(matches[0].linkedAuditId, "AUD-01");
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(1,
    { question: `Registrar riesgo\n${fields("Efímero")}` }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});
