const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-integration-test-secret-32-characters";

const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { buildAssistantContext, rankAssistantRecords } = require("../services/assistantContextService");
const { askAzureOpenAi, configuration, readiness } = require("../services/azureOpenAiService");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const findingRepository = require("../repositories/findingRepository");

const auth = (id, method = "GET", body) => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body ? { "Content-Type": "application/json" } : {})
}, ...(body ? { body: JSON.stringify(body) } : {}) });

test("Copiloto: prioriza registros que coinciden con la intención aunque estén fuera de los primeros 20", () => {
  const risks = Array.from({ length: 25 }, (_, index) => ({
    id: `RSK-${index + 1}`, title: `Riesgo ${index + 1}`, level: index === 24 ? "Alto" : "Medio"
  }));
  const selected = rankAssistantRecords("risks", risks, "¿Qué riesgos altos requieren atención?");
  assert.equal(selected.length, 20);
  assert.equal(selected[0].id, "RSK-25");
  assert.equal(rankAssistantRecords("risks", risks, "¿Qué riesgos altos hay?", new Set(["RSK-2"]))[0].id, "RSK-2");
  const audits = [{ id: "AUD-1", title: "Auditoría A", status: "CLOSED" },
    { id: "AUD-2", title: "Auditoría B", status: "ACTIVE" }];
  assert.equal(rankAssistantRecords("audits", audits, "auditorías activas")[0].id, "AUD-2");
  const controls = [{ id: "CTL-1", title: "Control A", effectiveness: 5 },
    { id: "CTL-2", title: "Control B", effectiveness: 2 }];
  assert.equal(rankAssistantRecords("controls", controls, "controles inefectivos")[0].id, "CTL-2");
});

test("HU-34: contexto de Auditoría excluye expedientes, riesgos y hallazgos ajenos", async () => {
  const ownedRisk = riskRepository.create({ title: "Riesgo asignado", ownerId: 5, level: "Alto", score: 6,
    likelihood: 3, impact: 2, note: "Riesgo asignado al auditor", createdBy: { id: 3 } });
  const otherRisk = riskRepository.create({ title: "Riesgo ajeno confidencial", ownerId: 4, level: "Medio", score: 4,
    likelihood: 2, impact: 2, note: "Riesgo de otro usuario", createdBy: { id: 3 } });
  const sharedControl = controlRepository.create({ title: "Control compartido", riskIds: [ownedRisk.id, otherRisk.id],
    effectiveness: 2, note: "Control compartido", createdBy: { id: 3 } });
  findingRepository.create({ title: "Hallazgo propio", riskId: ownedRisk.id, controlId: sharedControl.id, createdBy: { id: 5 } });
  findingRepository.create({ title: "Hallazgo ajeno confidencial", riskId: otherRisk.id, controlId: sharedControl.id, createdBy: { id: 3 } });
  const { context, references } = await buildAssistantContext({ id: 5, role: "AUDITOR" }, "riesgos y auditorías");
  assert.equal(context.scope.includes("Solo auditorías"), true);
  assert.ok(context.records.audits.every((item) => item.id !== "AUD-01"));
  assert.ok(context.records.risks.some((item) => item.id === ownedRisk.id));
  assert.ok(!context.records.risks.some((item) => item.id === otherRisk.id));
  assert.ok(context.records.findings.some((item) => item.title === "Hallazgo propio"));
  assert.ok(!context.records.findings.some((item) => item.title.includes("ajeno")));
  assert.ok(context.records.controls.every((item) => item.riskIds.every((id) =>
    context.records.risks.some((risk) => risk.id === id))));
  assert.ok(references.every((item) => item.path.startsWith("/")));
  assert.equal(context.selection.risks.visible >= context.selection.risks.included, true);
  assert.equal(context.selection.risks.included, context.records.risks.length);
  const focused = await buildAssistantContext({ id: 5, role: "AUDITOR" }, "resume este riesgo", { type: "risk", id: ownedRisk.id });
  assert.equal(focused.context.focus.id, ownedRisk.id);
  assert.ok(focused.context.records.risks.some((item) => item.id === ownedRisk.id));
  assert.ok(focused.sourceCatalog.some((item) => item.sourceId === `risks:${ownedRisk.id}`));
  await assert.rejects(buildAssistantContext({ id: 5, role: "AUDITOR" }, "resume este riesgo",
    { type: "risk", id: otherRisk.id }), (error) => error.status === 404 && !error.message.includes("confidencial"));
  await assert.rejects(buildAssistantContext({ id: 5, role: "UNKNOWN" }, "riesgo"),
    (error) => error.status === 403);
});

test("HU-34: la API exige sesión, valida la pregunta y muestra estado sin secretos", async (t) => {
  const base = await startTestServer(t, app);
  assert.equal((await fetch(`${base}/api/assistant/status`)).status, 401);
  assert.equal((await fetch(`${base}/api/assistant/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "Hola" }) })).status, 401);
  const status = await fetch(`${base}/api/assistant/status`, auth(5));
  assert.equal(status.status, 200);
  assert.equal(status.headers.get("cache-control"), "no-store");
  assert.deepEqual(await status.json(), { available: false, reason: "azure-not-configured", mode: "read-only" });
  assert.equal((await fetch(`${base}/api/assistant/ask`, auth(5, "POST", { question: "x" }))).status, 400);
  assert.equal((await fetch(`${base}/api/assistant/ask`, auth(5, "POST", { question: "riesgos", history: Array(7).fill({ role: "user", text: "hola" }) }))).status, 400);
  const brief = await fetch(`${base}/api/assistant/brief`, auth(5));
  assert.equal(brief.status, 200);
  assert.equal((await brief.json()).role, "AUDITOR");
  assert.equal((await fetch(`${base}/api/assistant/ask`, auth(5, "POST", { question: "¿Qué riesgos hay?" }))).status, 503);
});

test("HU-34: Azure recibe contexto filtrado y la respuesta no contiene la clave", async () => {
  const previous = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT
  };
  process.env.AZURE_OPENAI_ENDPOINT = "https://vera-test.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key-only";
  process.env.AZURE_OPENAI_DEPLOYMENT = "vera-chat";
  process.env.VERA_AI_ENABLED = "true";
  try {
    assert.equal(configuration().deployment, "vera-chat");
    process.env.VERCEL_ENV = "production";
    assert.deepEqual(readiness(), { available: false, reason: "persistent-stores-required" });
    delete process.env.VERCEL_ENV;
    const result = await askAzureOpenAi({ question: "¿Qué hay?", context: { counts: { risks: 0 },
      sources: [{ sourceId: "risks:RSK-1" }] }, history: [{ role: "user", text: "¿Y ese riesgo?" }],
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://vera-test.openai.azure.com/openai/v1/chat/completions");
        assert.equal(options.headers["api-key"], "test-key-only");
        const request = JSON.parse(options.body);
        assert.equal(request.model, "vera-chat");
        assert.ok(request.messages[1].content.includes('"risks":0'));
        assert.ok(request.messages[1].content.includes("¿Y ese riesgo?"));
        assert.equal(request.response_format.type, "json_object");
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ answer: "No hay riesgos visibles.", sourceIds: ["risks:RSK-1", "risks:FAKE"] }) } }], usage: { prompt_tokens: 30, completion_tokens: 9 } }) };
      } });
    assert.equal(result.answer, "No hay riesgos visibles.");
    assert.deepEqual(result.sourceIds, ["risks:RSK-1"]);
    assert.ok(!JSON.stringify(result).includes("test-key-only"));
    process.env.AZURE_OPENAI_ENDPOINT = "http://localhost:3000";
    assert.throws(() => configuration(), /recurso oficial/);
  } finally {
    delete process.env.VERCEL_ENV;
    if (previous.endpoint === undefined) delete process.env.AZURE_OPENAI_ENDPOINT;
    else process.env.AZURE_OPENAI_ENDPOINT = previous.endpoint;
    if (previous.key === undefined) delete process.env.AZURE_OPENAI_API_KEY;
    else process.env.AZURE_OPENAI_API_KEY = previous.key;
    if (previous.deployment === undefined) delete process.env.AZURE_OPENAI_DEPLOYMENT;
    else process.env.AZURE_OPENAI_DEPLOYMENT = previous.deployment;
    delete process.env.VERA_AI_ENABLED;
  }
});

test("HU-34: fallas del proveedor no filtran el cuerpo remoto", async () => {
  process.env.AZURE_OPENAI_ENDPOINT = "https://vera-test.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key-only";
  process.env.AZURE_OPENAI_DEPLOYMENT = "vera-chat";
  process.env.VERA_AI_ENABLED = "true";
  try {
    await assert.rejects(askAzureOpenAi({ question: "Hola", context: {},
      fetchImpl: async () => ({ ok: false, status: 500, text: async () => "SECRET FROM PROVIDER" }) }),
    (error) => error.status === 502 && !error.message.includes("SECRET"));
    await assert.rejects(askAzureOpenAi({ question: "Hola", context: {},
      fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "texto inválido" } }] }) }) }),
    (error) => error.status === 502);
    await assert.rejects(askAzureOpenAi({ question: "Hola", context: {},
      fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: "length", message: { content: "{\"answer\":\"incompleta\"}" } }] }) }) }),
    (error) => error.status === 502);
  } finally {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.VERA_AI_ENABLED;
  }
});

test("HU-34: la ruta responde con Azure simulado y excluye datos ajenos antes de enviarlos", async (t) => {
  const base = await startTestServer(t, app);
  const originalFetch = global.fetch;
  process.env.VERA_AI_ENABLED = "true";
  process.env.AZURE_OPENAI_ENDPOINT = "https://vera-test.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key-only";
  process.env.AZURE_OPENAI_DEPLOYMENT = "vera-chat";
  global.fetch = (url, options) => {
    const target = new URL(String(url));
    if (target.hostname !== "vera-test.openai.azure.com" ||
        target.pathname !== "/openai/v1/chat/completions") return originalFetch(url, options);
    const prompt = JSON.parse(options.body).messages[1].content;
    assert.ok(prompt.includes("Riesgo asignado"));
    assert.ok(!prompt.includes("Riesgo ajeno confidencial"));
    assert.ok(!prompt.includes("Hallazgo ajeno confidencial"));
    return Promise.resolve(Response.json({ choices: [{ message: { content: JSON.stringify({ answer: "Tienes un riesgo visible.", sourceIds: [] }) } }],
      usage: { prompt_tokens: 42, completion_tokens: 6 } }));
  };
  try {
    const response = await global.fetch(`${base}/api/assistant/ask`, auth(5, "POST", { question: "¿Qué riesgos tengo?" }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.answer, "Tienes un riesgo visible.");
    assert.ok(body.references.every((item) => item.type === "Riesgo"));
    assert.ok(!JSON.stringify(body).includes("test-key-only"));
  } finally {
    global.fetch = originalFetch;
    delete process.env.VERA_AI_ENABLED;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
  }
});
