const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-semantic-test-secret-32-chars";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const attachments = require("../repositories/assistantAttachmentRepository");
const index = require("../repositories/assistantSemanticIndexRepository");
const { embedTexts } = require("../services/azureEmbeddingService");
const { askProjectKnowledge, indexProjectFile } = require("../services/assistantProjectKnowledgeService");

const PROJECT = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222";
const otherFile = "33333333-3333-4333-8333-333333333333";
const user = { id: 5, role: "AUDITOR" };
const vector = (at = 0) => Array.from({ length: 512 }, (_, i) => Number(i === at));
const file = (id, text) => ({ id, name: "plan.txt", project_id: PROJECT,
  file: { mime: "text/plain", size: text.length },
  chunks: [{ chunkIndex: 0, pageNumber: null, content: text }], truncated: false });

const withConfig = (t) => {
  const keys = ["VERA_AI_ENABLED", "VERA_AI_SEMANTIC_ENABLED", "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_EMBEDDING_DEPLOYMENT"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { VERA_AI_ENABLED: "true", VERA_AI_SEMANTIC_ENABLED: "true",
    AZURE_OPENAI_ENDPOINT: "https://vera-test.openai.azure.com", AZURE_OPENAI_API_KEY: "test-only-key",
    AZURE_OPENAI_DEPLOYMENT: "vera-chat", AZURE_OPENAI_EMBEDDING_DEPLOYMENT: "vera-embedding" });
  t.after(() => { for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
};

test("Azure embeddings valida tamaño, orden y respuestas sin guardar texto", async (t) => {
  withConfig(t);
  const called = [];
  const result = await embedTexts(["primero", "segundo"], { fetchImpl: async (url, options) => {
    called.push(url);
    const body = JSON.parse(options.body);
    assert.equal(body.model, "vera-embedding");
    assert.equal(body.dimensions, 512);
    return Response.json({ data: [{ index: 1, embedding: vector(1) },
      { index: 0, embedding: vector(0) }], usage: { prompt_tokens: 9 } });
  } });
  assert.equal(called.length, 1);
  assert.equal(result.vectors[0][0], 1);
  assert.equal(result.vectors[1][1], 1);
  await assert.rejects(embedTexts(["texto"], { fetchImpl: async () =>
    Response.json({ data: [{ index: 0, embedding: [1, 2] }] }) }), /vectores inválidos/);
  await assert.rejects(embedTexts([]), /texto para indexar/);
  await assert.rejects(embedTexts(["texto"], { fetchImpl: async () =>
    new Response("", { status: 429 }) }), /límite temporal/);
  await assert.rejects(embedTexts(["texto"], { fetchImpl: async () => {
    throw new Error("synthetic network failure");
  } }), /No se pudo conectar/);
  await assert.rejects(embedTexts(["texto", "texto"], { fetchImpl: async () =>
    Response.json({ data: [{ index: 0, embedding: vector(0) },
      { index: 0, embedding: vector(0) }] }) }), /vectores duplicados/);
});

test("Repositorio Supabase: limita RPC al propietario y no devuelve vectores al cliente", async (t) => {
  const keys = ["VERA_USER_STORE", "SUPABASE_URL", "SUPABASE_SECRET_KEY"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { VERA_USER_STORE: "supabase", SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_synthetic" });
  const originalFetch = global.fetch;
  const calls = [];
  t.after(() => { global.fetch = originalFetch; for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  global.fetch = async (input, options) => {
    const path = new URL(input).pathname;
    const body = JSON.parse(options.body);
    calls.push({ path, body, headers: options.headers });
    if (path.endsWith("vector_status")) return Response.json([{ attachment_id: FILE, indexed_chunks: 1 }]);
    if (path.endsWith("search_project_vectors")) return Response.json([{
      attachment_id: FILE, chunk_index: 0, score: 0.91
    }]);
    return Response.json(null);
  };
  assert.equal((await index.status(user, PROJECT)).get(FILE), 1);
  await index.replace(user, PROJECT, FILE, [vector(0)]);
  assert.deepEqual(await index.search(user, PROJECT, vector(0)), [{ attachmentId: FILE,
    chunkIndex: 0, score: 0.91 }]);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].body.p_owner_id, 5);
  assert.equal(calls[0].body.p_owner_role, "AUDITOR");
  assert.equal(calls[0].body.p_project_id, PROJECT);
  assert.equal(calls[1].body[0].model, "text-embedding-3-small:512");
  assert.equal(calls[1].body[0].embedding.startsWith("[1,0,"), true);
  assert.equal(calls[2].body.p_owner_id, 5);
  assert.equal(calls[2].body.p_project_id, PROJECT);
  assert.equal(calls.every((call) => !call.headers.Authorization), true);
  await assert.rejects(index.status({ id: 0, role: "AUDITOR" }, PROJECT), /índice semántico/);
  await assert.rejects(index.replace(user, PROJECT, FILE, [[1, 2]]), /índice semántico/);
  global.fetch = async () => new Response("", { status: 503 });
  await assert.rejects(index.search(user, PROJECT, vector(0)), /índice semántico/);
});

test("La búsqueda semántica solo recupera archivos preparados del proyecto y rol propios", async (t) => {
  withConfig(t);
  const own = file(FILE, "El plan de respaldo se ejecuta cada mes.");
  const foreign = file(otherFile, "Una contraseña ajena no debe aparecer.");
  const embed = async () => ({ vectors: [vector(0)], usage: { prompt_tokens: 20 } });
  const indexed = await indexProjectFile(user, PROJECT, own, { embed });
  assert.equal(indexed.alreadyIndexed, false);
  assert.equal((await indexProjectFile(user, PROJECT, own, { embed })).alreadyIndexed, true);
  await index.replace({ id: 4, role: "GERENTE" }, PROJECT, otherFile, [vector(0)]);
  const ask = async ({ context }) => ({ answer: "Hay una medida de contingencia mensual.",
    sourceIds: [context.sources[0].sourceId] });
  const response = await askProjectKnowledge([own], PROJECT, "¿Qué medida de contingencia existe?",
    { user, embed, ask });
  assert.equal(response.mode, "attachment-project");
  assert.equal(response.coverage.retrieval, "lexical+semantic");
  assert.deepEqual(response.citations.map((item) => item.attachmentId), [FILE]);
  assert.equal((await index.search({ id: 4, role: "GERENTE" }, PROJECT, vector(0)))[0].attachmentId, otherFile);
  assert.equal((await index.search(user, "44444444-4444-4444-8444-444444444444", vector(0))).length, 0);
  const fallback = await askProjectKnowledge([own], PROJECT, "¿Qué medida de contingencia existe?",
    { user, embed: async () => { throw new Error("Azure temporalmente inactivo"); }, ask });
  assert.equal(fallback.mode, "no-match");
  assert.equal(fallback.coverage.semanticUnavailable, true);
  index.forget(FILE);
  assert.equal((await index.status(user, PROJECT)).has(FILE), false);
});

test("API de preparación: archivo ajeno devuelve 404 y el propio puede prepararse", async (t) => {
  withConfig(t);
  const keys = ["VERA_USER_STORE", "VERA_AI_CONVERSATIONS_ENABLED", "VERA_AI_PROJECTS_ENABLED",
    "VERA_AI_ATTACHMENTS_ENABLED", "VERA_AI_PROJECT_FILES_ENABLED", "VERA_AI_PROJECT_KNOWLEDGE_ENABLED"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { VERA_USER_STORE: "memory", VERA_AI_CONVERSATIONS_ENABLED: "true",
    VERA_AI_PROJECTS_ENABLED: "true", VERA_AI_ATTACHMENTS_ENABLED: "true",
    VERA_AI_PROJECT_FILES_ENABLED: "true", VERA_AI_PROJECT_KNOWLEDGE_ENABLED: "true" });
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  global.fetch = async (input, options) => {
    if (!String(input).includes("/openai/v1/embeddings")) return originalFetch(input, options);
    const inputs = JSON.parse(options.body).input;
    return Response.json({ data: inputs.map((_, i) => ({ index: i, embedding: vector(0) })),
      usage: { prompt_tokens: 17 } });
  };
  const auth = (id, body) => ({ method: body ? "POST" : "GET", headers: {
    Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
    ...(body ? { "Content-Type": "application/json" } : {})
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const base = await startTestServer(t, app);
  const project = (await (await originalFetch(`${base}/api/assistant/projects`,
    auth(5, { name: "Semántico" }))).json()).project;
  const saved = await attachments.createProject(user, project.id, {
    name: "plan.txt", file: { mime: "text/plain", size: 12 }, status: "ready", truncated: false,
    chunks: [{ chunkIndex: 0, pageNumber: null, content: "Respaldo mensual" }] });
  t.after(() => attachments.removeProject(user, project.id, saved.id));
  const path = `${base}/api/assistant/projects/${project.id}/files/${saved.id}/semantic`;
  assert.equal((await originalFetch(path, auth(4, {}))).status, 404);
  assert.equal((await originalFetch(path, auth(5, {}))).status, 200);
  const files = await (await originalFetch(`${base}/api/assistant/projects/${project.id}/files`, auth(5))).json();
  assert.equal(files.files[0].semanticReady, true);
  assert.equal((await originalFetch(`${base}/api/assistant/projects/${project.id}/files`, auth(4))).status, 404);
});
