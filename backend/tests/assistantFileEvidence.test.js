const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-file-evidence-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const evidenceRepository = require("../repositories/evidenceRepository");
const { parseFields } = require("../services/assistantFileEvidenceService");

const auth = (id, method = "GET", body) => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body === undefined ? {} : { "Content-Type": "application/json" })
}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const fields = (title) => `Título: ${title}\nDescripción: Documento que respalda la revisión del proceso auditado\nTipo: documento\nEntidad: auditoría\nIdentificador: AUD-01`;
const conversation = async (base, id, fetchImpl) => {
  const response = await fetchImpl(`${base}/api/assistant/conversations`, auth(id, "POST", { focus: null }));
  assert.equal(response.status, 201);
  return (await response.json()).conversation.id;
};
const ask = (base, threadId, id, question, fetchImpl, attachmentId = null) =>
  fetchImpl(`${base}/api/assistant/conversations/${threadId}/ask`,
    auth(id, "POST", { question, ...(attachmentId ? { attachmentId } : {}) }));
const upload = async (base, threadId, id, fetchImpl) => {
  const response = await fetchImpl(`${base}/api/assistant/conversations/${threadId}/attachments`, {
    method: "POST", headers: { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
      "Content-Type": "text/plain", "X-File-Name": "acta.txt" },
    body: Buffer.from("Acta de revisión del proceso con resultados documentados.") });
  assert.equal(response.status, 201);
  return (await response.json()).attachment;
};

test("El vínculo de archivo pide los campos sin incluir referencias públicas", () => {
  assert.equal(parseFields(fields("Acta A")).fields.entityType, "AUDIT");
  assert.equal(parseFields(fields("Acta A")).fields.evidenceType, "DOCUMENT");
  assert.match(parseFields("Título: Acta A").error, /Faltan campos/);
});

test("Archivo del chat pasa a evidencia privada con confirmación y sobrevive al borrado del adjunto", async (context) => {
  const originalFetch = global.fetch;
  const previous = { conversations: process.env.VERA_AI_CONVERSATIONS_ENABLED,
    attachments: process.env.VERA_AI_ATTACHMENTS_ENABLED,
    url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  process.env.VERA_AI_ATTACHMENTS_ENABLED = "true";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
  const files = new Map();
  global.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname !== "supabase.example") return originalFetch(input, options);
    if (options.method === "POST" && url.pathname.startsWith("/storage/v1/object/vera-evidence/")) {
      files.set(url.pathname, Buffer.from(options.body));
      return Response.json({ Key: url.pathname });
    }
    if (!options.method || options.method === "GET") {
      const bytes = files.get(url.pathname);
      return bytes ? new Response(bytes, { headers: { "Content-Length": String(bytes.length) } })
        : new Response(null, { status: 404 });
    }
    if (options.method === "DELETE") {
      for (const path of JSON.parse(options.body).prefixes) files.delete(`/storage/v1/object/vera-evidence/${path}`);
      return Response.json([]);
    }
    throw new Error(`Solicitud inesperada: ${options.method} ${url.pathname}`);
  };
  context.after(() => {
    global.fetch = originalFetch;
    for (const [name, value] of [["VERA_AI_CONVERSATIONS_ENABLED", previous.conversations],
      ["VERA_AI_ATTACHMENTS_ENABLED", previous.attachments], ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const base = await startTestServer(context, app);
  const threadId = await conversation(base, 3, originalFetch);
  const attached = await upload(base, threadId, 3, originalFetch);
  const before = (await evidenceRepository.getAll()).length;
  const first = await ask(base, threadId, 3, "Vincula este archivo como evidencia", originalFetch, attached.id);
  assert.match((await first.json()).message.text, /Título:/);
  const inaccessible = await ask(base, threadId, 3,
    fields("Acta no vinculada").replace("AUD-01", "AUD-INEXISTENTE"), originalFetch, attached.id);
  assert.equal((await inaccessible.json()).message.mode, "action-guidance");
  assert.equal((await evidenceRepository.getAll()).length, before);
  const title = `Acta vinculada ${Date.now()}`;
  const preview = await ask(base, threadId, 3, fields(title), originalFetch, attached.id);
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await evidenceRepository.getAll()).length, before);
  const confirmed = await ask(base, threadId, 3, "Confirmar archivo como evidencia", originalFetch);
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.equal(result.message.mode, "action-executed", result.message.text);
  assert.equal(result.historySaved, true);
  const evidence = await evidenceRepository.findById(result.message.actionOutcome.id);
  assert.equal(evidence.title, title);
  assert.equal(evidence.entityId, "AUD-01");
  assert.equal(evidence.file.mime, "text/plain");
  assert.match(evidence.file.path, /^audit\/AUD-01\//);
  assert.equal(files.size, 2);
  assert.equal(files.has(`/storage/v1/object/vera-evidence/${evidence.file.path}`), true);
  assert.equal((await evidenceRepository.getAll()).length, before + 1);
  const removed = await originalFetch(`${base}/api/assistant/conversations/${threadId}/attachments/${attached.id}`,
    auth(3, "DELETE"));
  assert.equal(removed.status, 204);
  assert.equal(files.has(`/storage/v1/object/vera-evidence/${evidence.file.path}`), true);
  assert.equal((await (await ask(base, threadId, 3, "Confirmar archivo como evidencia", originalFetch)).json()).message.mode,
    "action-guidance");
});

test("Sin archivo seleccionado, rol de escritura o expediente visible no se crea evidencia", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  const managerThread = await conversation(base, 3, fetch);
  assert.match((await (await ask(base, managerThread, 3,
    "Vincula este archivo como evidencia", fetch)).json()).message.text, /Selecciona primero/);
  const directorThread = await conversation(base, 2, fetch);
  assert.match((await (await ask(base, directorThread, 2,
    "Vincula este archivo como evidencia", fetch)).json()).message.text, /no registrarlos/);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, auth(3, "POST",
    { question: "Vincula este archivo como evidencia" }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});
