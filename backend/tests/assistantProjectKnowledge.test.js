const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-project-knowledge-test-secret-32-chars";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const attachments = require("../repositories/assistantAttachmentRepository");
const { askProjectKnowledge } = require("../services/assistantProjectKnowledgeService");

const file = (id, name, text, projectId) => ({ id, name, project_id: projectId,
  file: { mime: "text/plain", size: text.length }, chunks: [{ chunkIndex: 0,
    pageNumber: null, content: text }], truncated: false });
const auth = (id, body) => ({ method: body ? "POST" : "GET", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body ? { "Content-Type": "application/json" } : {})
}, ...(body ? { body: JSON.stringify(body) } : {}) });

test("Biblioteca IA: la síntesis cita solo fragmentos seleccionados y rechaza totales", async () => {
  const projectId = "11111111-1111-4111-8111-111111111111";
  const files = [file("22222222-2222-4222-8222-222222222222", "proveedor.txt",
    "El proveedor A requiere revisión anual.", projectId),
  file("33333333-3333-4333-8333-333333333333", "control.txt",
    "El control de acceso se verificó en octubre.", projectId)];
  let calls = 0;
  const ask = async ({ context }) => {
    calls += 1;
    assert.equal(context.selection.partial, true);
    assert.equal(context.records.attachment.length, 1);
    assert.equal(context.records.attachment[0].title, "proveedor.txt");
    return { answer: "Requiere revisión anual.", sourceIds: [context.sources[0].sourceId,
      "attachment:foreign:chunk:0"] };
  };
  const answer = await askProjectKnowledge(files, projectId, "¿Qué requiere el proveedor?", { ask });
  assert.equal(answer.mode, "attachment-project");
  assert.equal(answer.citations.length, 1);
  assert.equal(answer.citations[0].projectId, projectId);
  assert.equal(answer.citations[0].title, "proveedor.txt");
  assert.equal((await askProjectKnowledge(files, projectId, "¿Cuántos controles hay en total?", { ask })).mode,
    "scope-limited");
  assert.equal((await askProjectKnowledge(files, projectId, "¿Qué dice sobre impuestos?", { ask })).mode,
    "no-match");
  assert.equal(calls, 1);
});

test("Biblioteca IA: la API consulta solo archivos del proyecto propio y exige la bandera", async (t) => {
  const keys = ["VERA_USER_STORE", "VERA_AI_ENABLED", "VERA_AI_CONVERSATIONS_ENABLED",
    "VERA_AI_PROJECTS_ENABLED", "VERA_AI_ATTACHMENTS_ENABLED", "VERA_AI_PROJECT_FILES_ENABLED",
    "VERA_AI_PROJECT_KNOWLEDGE_ENABLED", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_DEPLOYMENT"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  Object.assign(process.env, { VERA_USER_STORE: "memory", VERA_AI_ENABLED: "true",
    VERA_AI_CONVERSATIONS_ENABLED: "true", VERA_AI_PROJECTS_ENABLED: "true",
    VERA_AI_ATTACHMENTS_ENABLED: "true", VERA_AI_PROJECT_FILES_ENABLED: "true",
    VERA_AI_PROJECT_KNOWLEDGE_ENABLED: "true", AZURE_OPENAI_ENDPOINT: "https://vera-test.openai.azure.com",
    AZURE_OPENAI_API_KEY: "test-only-key", AZURE_OPENAI_DEPLOYMENT: "vera-chat" });
  t.after(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  global.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.hostname !== "vera-test.openai.azure.com") return originalFetch(input, options);
    const body = JSON.parse(options.body);
    const context = JSON.parse(body.messages[1].content.split("CONTEXTO autorizado (JSON):\n")[1]
      .split("\n\nMEMORIA")[0]);
    assert.equal(context.sources.length, 1);
    assert.equal(context.records.attachment[0].title, "propio.txt");
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      answer: "El proveedor propio requiere revisión.", sourceIds: [context.sources[0].sourceId]
    }) } }] });
  };
  const base = await startTestServer(t, app);
  const project = (await (await originalFetch(`${base}/api/assistant/projects`,
    auth(5, { name: "Proyecto propio" }))).json()).project;
  const foreign = (await (await originalFetch(`${base}/api/assistant/projects`,
    auth(4, { name: "Proyecto ajeno" }))).json()).project;
  const ownFile = await attachments.createProject({ id: 5, role: "AUDITOR" }, project.id, {
    name: "propio.txt", file: { mime: "text/plain", size: 30 }, status: "ready", truncated: false,
    chunks: [{ chunkIndex: 0, pageNumber: null, content: "El proveedor propio requiere revisión." }] });
  const foreignFile = await attachments.createProject({ id: 4, role: "JEFATURA" }, foreign.id, {
    name: "ajeno.txt", file: { mime: "text/plain", size: 30 }, status: "ready", truncated: false,
    chunks: [{ chunkIndex: 0, pageNumber: null, content: "Proveedor ajeno requiere revisión." }] });
  t.after(async () => {
    await attachments.removeProject({ id: 5, role: "AUDITOR" }, project.id, ownFile.id);
    await attachments.removeProject({ id: 4, role: "JEFATURA" }, foreign.id, foreignFile.id);
  });
  const thread = (await (await originalFetch(`${base}/api/assistant/conversations`,
    auth(5, { projectId: project.id }))).json()).conversation;
  const path = `${base}/api/assistant/conversations/${thread.id}/ask`;
  assert.equal((await originalFetch(path, auth(5, { question: "¿Qué requiere el proveedor?",
    projectFiles: true, attachmentId: ownFile.id }))).status, 400);
  const response = await originalFetch(path, auth(5, { question: "¿Qué requiere el proveedor?",
    projectFiles: true }));
  assert.equal(response.status, 200);
  const message = (await response.json()).message;
  assert.equal(message.mode, "attachment-project");
  assert.equal(message.citations[0].projectId, project.id);
  assert.equal(message.citations[0].title, "propio.txt");
  process.env.VERA_AI_PROJECT_KNOWLEDGE_ENABLED = "false";
  assert.equal((await originalFetch(path, auth(5, { question: "¿Qué requiere el proveedor?",
    projectFiles: true }))).status, 400);
});
