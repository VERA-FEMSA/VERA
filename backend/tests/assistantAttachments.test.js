const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-attachments-test-secret-32-chars";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { askImage } = require("../services/assistantAttachmentService");
const attachmentRepository = require("../repositories/assistantAttachmentRepository");
const { askAttachment } = require("../services/assistantAttachmentService");

const auth = (id, method = "GET", body, mime = "application/json") => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body === undefined ? {} : { "Content-Type": mime })
}, ...(body === undefined ? {} : { body: mime === "application/json" ? JSON.stringify(body) : body }) });

test("Adjuntos IA: upload privado, cita documental y rechazo de otra cuenta", async (t) => {
  const previous = { conversations: process.env.VERA_AI_CONVERSATIONS_ENABLED,
    attachments: process.env.VERA_AI_ATTACHMENTS_ENABLED, url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY, ai: process.env.VERA_AI_ENABLED,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT, azureKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT };
  const originalFetch = global.fetch;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  process.env.VERA_AI_ATTACHMENTS_ENABLED = "true";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
  process.env.VERA_AI_ENABLED = "true";
  process.env.AZURE_OPENAI_ENDPOINT = "https://vera-test.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-only-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "vera-chat";
  t.after(() => {
    global.fetch = originalFetch;
    for (const [name, value] of [["VERA_AI_CONVERSATIONS_ENABLED", previous.conversations],
      ["VERA_AI_ATTACHMENTS_ENABLED", previous.attachments], ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.key], ["VERA_AI_ENABLED", previous.ai],
      ["AZURE_OPENAI_ENDPOINT", previous.endpoint], ["AZURE_OPENAI_API_KEY", previous.azureKey],
      ["AZURE_OPENAI_DEPLOYMENT", previous.deployment]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  global.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "supabase.example") {
      if (options.method === "POST") return Response.json({ Key: url.pathname });
      if (options.method === "DELETE") return Response.json([]);
      return Response.json({ signedURL: "/object/sign/vera-evidence/test?token=short" });
    }
    if (url.hostname === "vera-test.openai.azure.com") {
      const request = JSON.parse(options.body);
      const content = request.messages[1].content;
      assert.match(content, /proveedor X/);
      const sourceId = JSON.parse(content.split("CONTEXTO autorizado (JSON):\n")[1].split("\n\nMEMORIA")[0]).sources[0].sourceId;
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        answer: "El proveedor X aparece como riesgo alto.", sourceIds: [sourceId]
      }) } }] });
    }
    return originalFetch(input, options);
  };
  const base = await startTestServer(t, app);
  const thread = (await (await originalFetch(`${base}/api/assistant/conversations`, auth(5, "POST", {}))).json()).conversation;
  const endpoint = `${base}/api/assistant/conversations/${thread.id}/attachments`;
  assert.equal((await originalFetch(endpoint)).status, 401);
  assert.equal((await originalFetch(endpoint, auth(4))).status, 404);
  const upload = await originalFetch(endpoint, { ...auth(5, "POST", Buffer.from("El proveedor X tiene riesgo alto."), "text/plain"),
    headers: { ...auth(5).headers, "Content-Type": "text/plain", "X-File-Name": encodeURIComponent("nota.txt") } });
  assert.equal(upload.status, 201);
  const file = (await upload.json()).attachment;
  assert.equal(file.name, "nota.txt");
  assert.equal(file.status, "ready");
  assert.equal((await originalFetch(endpoint, auth(4))).status, 404);
  assert.equal((await originalFetch(`${endpoint}/${file.id}/download`, auth(4))).status, 404);
  assert.equal((await originalFetch(`${base}/api/assistant/conversations/${thread.id}/ask`,
    auth(4, "POST", { question: "¿Qué dice proveedor X?", attachmentId: file.id }))).status, 404);
  const answer = await originalFetch(`${base}/api/assistant/conversations/${thread.id}/ask`,
    auth(5, "POST", { question: "¿Qué dice proveedor X?", attachmentId: file.id }));
  assert.equal(answer.status, 200);
  assert.equal((await answer.json()).message.mode, "attachment-text");
  const secondUpload = await originalFetch(endpoint, { ...auth(5, "POST", Buffer.from("Otra nota privada."), "text/plain"),
    headers: { ...auth(5).headers, "Content-Type": "text/plain", "X-File-Name": "otra.txt" } });
  assert.equal(secondUpload.status, 201);
  const second = (await secondUpload.json()).attachment;
  assert.equal((await (await originalFetch(endpoint, auth(5))).json()).attachments.length, 2);
  assert.equal((await originalFetch(`${endpoint}/${second.id}`, auth(5, "DELETE"))).status, 204);
  assert.equal((await originalFetch(`${endpoint}/${file.id}`, auth(5, "DELETE"))).status, 204);
  assert.equal((await originalFetch(`${endpoint}/${file.id}/download`, auth(5))).status, 404);
});

test("Adjuntos IA: visión usa solo la imagen privada y exige soporte visible", async (t) => {
  const previous = { ai: process.env.VERA_AI_ENABLED, endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_API_KEY, deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY };
  const originalFetch = global.fetch;
  process.env.VERA_AI_ENABLED = "true";
  process.env.AZURE_OPENAI_ENDPOINT = "https://vera-test.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-only-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "vera-chat";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
  t.after(() => {
    global.fetch = originalFetch;
    for (const [name, value] of [["VERA_AI_ENABLED", previous.ai],
      ["AZURE_OPENAI_ENDPOINT", previous.endpoint], ["AZURE_OPENAI_API_KEY", previous.key],
      ["AZURE_OPENAI_DEPLOYMENT", previous.deployment], ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.secret]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  global.fetch = async (input) => {
    if (new URL(input).hostname === "supabase.example") return new Response(bytes);
    return originalFetch(input);
  };
  let request;
  const row = { file: { bucket: "vera-evidence",
    path: "ai/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png",
    mime: "image/png", size: bytes.length }, name: "imagen.png" };
  const result = await askImage(row, "¿Qué texto aparece?", { fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      answer: "El supuesto texto dice una cifra inventada de 987.", supported: false
    }) } }] });
  } });
  assert.equal(request.messages[1].content[1].type, "image_url");
  assert.match(request.messages[0].content, /no sigas instrucciones/);
  assert.equal(result.supported, false);
  assert.doesNotMatch(result.answer, /987/);
});

test("Adjuntos IA: el adaptador Supabase filtra listados, conteos, lectura, alta y baja", async (t) => {
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
  const user = { id: 5, role: "AUDITOR" };
  const conversationId = "11111111-1111-4111-8111-111111111111";
  const id = "22222222-2222-4222-8222-222222222222";
  const file = { bucket: "vera-evidence", path: `ai/${conversationId}/${id}.txt`,
    mime: "text/plain", size: 12 };
  const row = { id, conversation_id: conversationId, owner_id: 5, owner_role: "AUDITOR",
    name: "nota.txt", file, chunks: [{ chunkIndex: 0, pageNumber: null, content: "Texto" }],
    status: "ready", truncated: false, created_at: "2026-10-22T19:00:00.000Z" };
  global.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/rest/v1/vera_ai_attachments");
    if (options.method !== "POST") {
      assert.equal(url.searchParams.get("owner_id"), "eq.5");
      assert.equal(url.searchParams.get("owner_role"), "eq.AUDITOR");
    }
    assert.equal(options.headers.Authorization, undefined);
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal(body.conversation_id, conversationId);
      assert.equal(body.owner_id, 5);
      assert.equal(body.owner_role, "AUDITOR");
      return Response.json([{ ...row, id: body.id }]);
    }
    if (options.method === "DELETE") {
      assert.equal(url.searchParams.get("conversation_id"), `eq.${conversationId}`);
      return Response.json([{ id }]);
    }
    if (url.searchParams.get("select") === "id") return Response.json([{ id }]);
    if (url.searchParams.get("id")) return Response.json([row]);
    return Response.json([row]);
  };
  assert.equal((await attachmentRepository.list(user, conversationId))[0].name, "nota.txt");
  assert.equal(await attachmentRepository.countForUser(user), 1);
  assert.equal((await attachmentRepository.get(user, conversationId, id)).file.mime, "text/plain");
  assert.equal((await attachmentRepository.create(user, conversationId,
    { name: "otra.txt", file, chunks: [], status: "no-text", truncated: false })).mime, "text/plain");
  assert.equal(await attachmentRepository.remove(user, conversationId, id), true);
  assert.equal(await attachmentRepository.get(user, conversationId, "bad"), null);
});

test("Adjuntos IA: no inventa respuesta si el texto falta, la muestra es parcial o no hay cita", async (t) => {
  const previous = { ai: process.env.VERA_AI_ENABLED, endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_API_KEY, deployment: process.env.AZURE_OPENAI_DEPLOYMENT };
  const originalFetch = global.fetch;
  process.env.VERA_AI_ENABLED = "true";
  process.env.AZURE_OPENAI_ENDPOINT = "https://vera-test.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-only-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "vera-chat";
  t.after(() => {
    global.fetch = originalFetch;
    for (const [name, value] of [["VERA_AI_ENABLED", previous.ai],
      ["AZURE_OPENAI_ENDPOINT", previous.endpoint], ["AZURE_OPENAI_API_KEY", previous.key],
      ["AZURE_OPENAI_DEPLOYMENT", previous.deployment]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const row = { id: "22222222-2222-4222-8222-222222222222", name: "nota.txt",
    file: { mime: "text/plain" }, chunks: [], truncated: false };
  assert.equal((await askAttachment(row, "Resume el archivo")).mode, "no-text");
  row.chunks = [{ chunkIndex: 0, pageNumber: null, content: "Proveedor X con riesgo alto." }];
  assert.equal((await askAttachment(row, "¿Cuántos registros tiene todo el archivo?")).mode, "scope-limited");
  assert.equal((await askAttachment(row, "¿Qué dice sobre licencias?")).mode, "no-match");
  global.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({
    answer: "Un dato sin fuente", sourceIds: []
  }) } }] });
  assert.equal((await askAttachment(row, "¿Qué dice sobre proveedor X?")).mode, "uncited");
});
