const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-project-files-test-secret-32-chars";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const attachmentRepository = require("../repositories/assistantAttachmentRepository");

const auth = (id, method = "GET", body, mime = "application/json") => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body === undefined ? {} : { "Content-Type": mime })
}, ...(body === undefined ? {} : { body: mime === "application/json" ? JSON.stringify(body) : body }) });

test("Biblioteca IA: archivo privado reusable en chats del proyecto y aislado de otras cuentas", async (t) => {
  const previous = Object.fromEntries(["VERA_AI_CONVERSATIONS_ENABLED", "VERA_AI_PROJECTS_ENABLED",
    "VERA_AI_ATTACHMENTS_ENABLED", "VERA_AI_PROJECT_FILES_ENABLED", "SUPABASE_URL",
    "SUPABASE_SECRET_KEY", "VERA_AI_ENABLED", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_DEPLOYMENT"].map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  Object.assign(process.env, {
    VERA_AI_CONVERSATIONS_ENABLED: "true", VERA_AI_PROJECTS_ENABLED: "true",
    VERA_AI_ATTACHMENTS_ENABLED: "true", VERA_AI_PROJECT_FILES_ENABLED: "true",
    SUPABASE_URL: "https://supabase.example", SUPABASE_SECRET_KEY: "sb_secret_test_only",
    VERA_AI_ENABLED: "true", AZURE_OPENAI_ENDPOINT: "https://vera-test.openai.azure.com",
    AZURE_OPENAI_API_KEY: "test-only-key", AZURE_OPENAI_DEPLOYMENT: "vera-chat"
  });
  t.after(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  global.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "supabase.example") {
      if (options.method === "POST" && url.pathname.includes("/object/sign/")) {
        return Response.json({ signedURL: "/object/sign/vera-evidence/test?token=short" });
      }
      if (options.method === "DELETE") return Response.json([]);
      return Response.json({ Key: url.pathname });
    }
    if (url.hostname === "vera-test.openai.azure.com") {
      const request = JSON.parse(options.body);
      const content = request.messages[1].content;
      const sourceId = JSON.parse(content.split("CONTEXTO autorizado (JSON):\n")[1].split("\n\nMEMORIA")[0]).sources[0].sourceId;
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        answer: "El proyecto menciona al proveedor X.", sourceIds: [sourceId]
      }) } }] });
    }
    return originalFetch(input, options);
  };
  const base = await startTestServer(t, app);
  const project = (await (await originalFetch(`${base}/api/assistant/projects`,
    auth(5, "POST", { name: "Proyecto privado" }))).json()).project;
  const other = (await (await originalFetch(`${base}/api/assistant/projects`,
    auth(5, "POST", { name: "Otro proyecto" }))).json()).project;
  const filesUrl = `${base}/api/assistant/projects/${project.id}/files`;
  assert.equal((await originalFetch(filesUrl)).status, 401);
  assert.equal((await originalFetch(filesUrl, auth(4))).status, 404);
  const upload = await originalFetch(filesUrl, { ...auth(5, "POST", Buffer.from("Proveedor X requiere revisión."), "text/plain"),
    headers: { ...auth(5).headers, "Content-Type": "text/plain", "X-File-Name": "contexto.txt" } });
  assert.equal(upload.status, 201);
  const file = (await upload.json()).file;
  assert.equal(file.projectId, project.id);
  assert.equal((await (await originalFetch(filesUrl, auth(5))).json()).files.length, 1);
  assert.equal((await originalFetch(`${base}/api/assistant/projects/${other.id}/files/${file.id}/download`, auth(5))).status, 404);
  assert.equal((await originalFetch(`${filesUrl}/${file.id}/download`, auth(4))).status, 404);
  assert.equal((await originalFetch(`${filesUrl}/${file.id}/download`, auth(5))).status, 200);
  const thread = (await (await originalFetch(`${base}/api/assistant/conversations`,
    auth(5, "POST", { projectId: project.id }))).json()).conversation;
  const second = (await (await originalFetch(`${base}/api/assistant/conversations`,
    auth(5, "POST", { projectId: project.id }))).json()).conversation;
  for (const id of [thread.id, second.id]) {
    const response = await originalFetch(`${base}/api/assistant/conversations/${id}/ask`,
      auth(5, "POST", { question: "¿Qué dice proveedor X?", attachmentId: file.id }));
    assert.equal(response.status, 200);
    const answer = (await response.json()).message;
    assert.equal(answer.mode, "attachment-text");
    assert.equal(answer.citations[0].projectId, project.id);
  }
  const outside = (await (await originalFetch(`${base}/api/assistant/conversations`,
    auth(5, "POST", { projectId: other.id }))).json()).conversation;
  assert.equal((await originalFetch(`${base}/api/assistant/conversations/${outside.id}/ask`,
    auth(5, "POST", { question: "¿Qué dice proveedor X?", attachmentId: file.id }))).status, 404);
  assert.equal((await originalFetch(`${base}/api/assistant/projects/${project.id}`, auth(5, "DELETE"))).status, 204);
  assert.equal((await originalFetch(`${filesUrl}/${file.id}/download`, auth(5))).status, 404);
  assert.equal((await originalFetch(`${base}/api/assistant/conversations/${thread.id}`, auth(5))).status, 200);
});

test("Biblioteca IA: el adaptador Supabase filtra por dueño y proyecto", async (t) => {
  const previous = { mode: process.env.VERA_USER_STORE, url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY };
  const originalFetch = global.fetch;
  process.env.VERA_USER_STORE = "supabase";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
  t.after(() => {
    global.fetch = originalFetch;
    for (const [name, value] of [["VERA_USER_STORE", previous.mode], ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const projectId = "11111111-1111-4111-8111-111111111111";
  const id = "22222222-2222-4222-8222-222222222222";
  const file = { bucket: "vera-evidence", path: `ai/${projectId}/${id}.txt`, mime: "text/plain", size: 12 };
  const row = { id, conversation_id: null, project_id: projectId, owner_id: 5, owner_role: "AUDITOR",
    name: "nota.txt", file, chunks: [], status: "ready", truncated: false,
    created_at: "2026-10-23T18:00:00.000Z" };
  global.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/rest/v1/vera_ai_attachments");
    if (options.method !== "POST") {
      assert.equal(url.searchParams.get("owner_id"), "eq.5");
      assert.equal(url.searchParams.get("owner_role"), "eq.AUDITOR");
    }
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal(body.project_id, projectId);
      assert.equal(body.conversation_id, null);
      return Response.json([{ ...row, id: body.id }]);
    }
    if (url.searchParams.get("select") === "id") return Response.json([row]);
    assert.equal(url.searchParams.get("project_id"), `eq.${projectId}`);
    if (options.method === "DELETE") return Response.json([{ id }]);
    return Response.json([row]);
  };
  const user = { id: 5, role: "AUDITOR" };
  assert.equal((await attachmentRepository.listProject(user, projectId))[0].name, "nota.txt");
  assert.equal((await attachmentRepository.getProject(user, projectId, id)).file.mime, "text/plain");
  assert.equal((await attachmentRepository.createProject(user, projectId,
    { name: "otra.txt", file, chunks: [], status: "ready", truncated: false })).projectId, projectId);
  assert.equal(await attachmentRepository.removeProject(user, projectId, id), true);
});

test("Biblioteca IA: el repositorio respeta cuatro archivos por proyecto", async (t) => {
  const priorMode = process.env.VERA_USER_STORE;
  process.env.VERA_USER_STORE = "memory";
  t.after(() => {
    if (priorMode === undefined) delete process.env.VERA_USER_STORE;
    else process.env.VERA_USER_STORE = priorMode;
  });
  const user = { id: 912, role: "AUDITOR" };
  const projectId = "44444444-4444-4444-8444-444444444444";
  const file = { bucket: "vera-evidence", path: "ai/example.txt", mime: "text/plain", size: 5 };
  const created = [];
  for (let i = 0; i < 4; i += 1) {
    created.push(await attachmentRepository.createProject(user, projectId,
      { name: `nota-${i}.txt`, file, chunks: [], status: "ready", truncated: false }));
  }
  assert.equal((await attachmentRepository.listProject(user, projectId)).length, 4);
  await assert.rejects(() => attachmentRepository.createProject(user, projectId,
    { name: "nota-5.txt", file, chunks: [], status: "ready", truncated: false }),
  (error) => error.status === 409);
  for (const item of created) assert.equal(await attachmentRepository.removeProject(user, projectId, item.id), true);
});
