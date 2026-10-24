const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-report-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { parseReportRequest } = require("../services/assistantReportService");

const auth = (id, question) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify({ question }) });
const getAuth = (id) => ({ headers: { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` } });

test("El comando de reporte distingue consulta y exportación explícita", () => {
  assert.deepEqual(parseReportRequest("Muéstrame el reporte del portafolio"), { exportCsv: false });
  assert.deepEqual(parseReportRequest("Exporta el informe del portafolio en CSV"), { exportCsv: true });
  assert.equal(parseReportRequest("Resume los riesgos"), null);
});

test("El chat entrega el mismo CSV autorizado que RF-29 sin guardar el archivo en el historial", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const createProposal = (title, responsibleId) => fetch(`${base}/api/planning`, {
    method: "POST", headers: { ...getAuth(3).headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title, objective: "Verificar el proceso de reporte.",
      scope: "Operación de prueba.", justification: "Hay que revisar las señales registradas.",
      area: "Operaciones", quarter: "Q4", year: 2026, responsibleId })
  });
  const visibleTitle = `Visible en informe IA ${Date.now()}`;
  const hiddenTitle = `Fuera del alcance IA ${Date.now()}`;
  assert.equal((await createProposal(visibleTitle, 5)).status, 201);
  assert.equal((await createProposal(hiddenTitle, null)).status, 201);
  const expected = Buffer.from(await (await fetch(`${base}/api/planning/report?format=csv`,
    getAuth(5))).arrayBuffer()).toString("utf8");
  const ephemeral = await fetch(`${base}/api/assistant/ask`, auth(5,
    "Exporta el reporte del portafolio en CSV"));
  assert.equal(ephemeral.status, 200);
  const exported = await ephemeral.json();
  assert.equal(exported.mode, "report-export");
  assert.equal(exported.downloadCsv, expected);
  assert.ok(exported.downloadCsv.includes(visibleTitle));
  assert.ok(!exported.downloadCsv.includes(hiddenTitle));
  const created = await fetch(`${base}/api/assistant/conversations`, auth(5, "Nueva conversación"));
  assert.equal(created.status, 201);
  const { conversation } = await created.json();
  const url = `${base}/api/assistant/conversations/${conversation.id}`;
  const summary = await fetch(`${url}/ask`, auth(5, "Muéstrame el reporte del portafolio"));
  assert.equal(summary.status, 200);
  assert.equal((await summary.json()).message.mode, "report");
  const download = await fetch(`${url}/ask`, auth(5, "Exporta el reporte del portafolio en CSV"));
  assert.equal(download.status, 200);
  const result = await download.json();
  assert.equal(result.message.mode, "report-export");
  assert.equal(result.downloadCsv, expected);
  const history = await (await fetch(url, getAuth(5))).json();
  assert.ok(!JSON.stringify(history).includes("ID auditoría"));
  assert.equal(history.conversation.messages.at(-1).mode, "report-export");
});
