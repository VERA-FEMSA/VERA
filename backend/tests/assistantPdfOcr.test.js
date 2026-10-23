const test = require("node:test");
const assert = require("node:assert/strict");
const { PDFDocument } = require("pdf-lib");
const jwt = require("jsonwebtoken");
const { extractScannedPdf } = require("../services/assistantPdfOcrService");
const attachments = require("../repositories/assistantAttachmentRepository");
process.env.JWT_SECRET ||= "assistant-pdf-ocr-test-secret-32-chars";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { randomUUID } = require("node:crypto");

const makePdf = async (pages = 3) => {
  const document = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) document.addPage([200, 200]);
  return Buffer.from(await document.save());
};

test("OCR PDF: solo dos páginas privadas llegan a Azure y el resultado queda acotado", async (t) => {
  const keys = ["VERA_AI_ENABLED", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_OCR_DEPLOYMENT"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { VERA_AI_ENABLED: "true",
    AZURE_OPENAI_ENDPOINT: "https://vera-test.openai.azure.com",
    AZURE_OPENAI_API_KEY: "test-only-key", AZURE_OPENAI_DEPLOYMENT: "vera-chat",
    AZURE_OPENAI_OCR_DEPLOYMENT: "vera-ocr" });
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  let calls = 0;
  const result = await extractScannedPdf(await makePdf(), { fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url, "https://vera-test.openai.azure.com/openai/v1/responses");
    assert.equal(options.headers["api-key"], "test-only-key");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.model, "vera-ocr");
    const input = body.input[0].content[0];
    assert.equal(input.type, "input_file");
    const selected = Buffer.from(input.file_data.split(",")[1], "base64");
    assert.equal((await PDFDocument.load(selected)).getPageCount(), 2);
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text",
      text: "Riesgo de proveedor con revisión pendiente." }] }], usage: { input_tokens: 120,
      output_tokens: 30 } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.status, "ready");
  assert.equal(result.totalPages, 3);
  assert.equal(result.pagesProcessed, 2);
  assert.equal(result.truncated, true);
  assert.match(result.chunks[0].content, /Riesgo de proveedor/);
  await assert.rejects(() => extractScannedPdf(Buffer.from("not-pdf")), (error) => error.status === 415);
});

test("OCR PDF: fallo de compatibilidad no genera texto ni simula éxito", async (t) => {
  const previous = { enabled: process.env.VERA_AI_ENABLED, endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_API_KEY, deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    ocrDeployment: process.env.AZURE_OPENAI_OCR_DEPLOYMENT };
  Object.assign(process.env, { VERA_AI_ENABLED: "true",
    AZURE_OPENAI_ENDPOINT: "https://vera-test.openai.azure.com",
    AZURE_OPENAI_API_KEY: "test-only-key", AZURE_OPENAI_DEPLOYMENT: "vera-chat",
    AZURE_OPENAI_OCR_DEPLOYMENT: "vera-ocr" });
  t.after(() => { for (const [key, value] of [["VERA_AI_ENABLED", previous.enabled],
    ["AZURE_OPENAI_ENDPOINT", previous.endpoint], ["AZURE_OPENAI_API_KEY", previous.key],
    ["AZURE_OPENAI_DEPLOYMENT", previous.deployment],
    ["AZURE_OPENAI_OCR_DEPLOYMENT", previous.ocrDeployment]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const onePage = await makePdf(1);
  delete process.env.AZURE_OPENAI_OCR_DEPLOYMENT;
  await assert.rejects(() => extractScannedPdf(onePage), (error) => error.status === 503);
  process.env.AZURE_OPENAI_OCR_DEPLOYMENT = "vera-ocr";
  await assert.rejects(() => extractScannedPdf(onePage, {
    fetchImpl: async () => new Response("unsupported", { status: 400 })
  }), (error) => error.status === 415);
  const empty = await extractScannedPdf(onePage, { fetchImpl: async () =>
    Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: "" }] }] }) });
  assert.equal(empty.status, "no-text");
  assert.equal(empty.chunks.length, 0);
});

test("OCR PDF: el resultado solo modifica el adjunto privado propio", async (t) => {
  const previous = process.env.VERA_USER_STORE;
  process.env.VERA_USER_STORE = "memory";
  t.after(() => { if (previous === undefined) delete process.env.VERA_USER_STORE;
    else process.env.VERA_USER_STORE = previous; });
  const user = { id: 914, role: "AUDITOR" };
  const projectId = "11111111-1111-4111-8111-111111111111";
  const file = { bucket: "vera-evidence", path: "ai/ocr-test.pdf", mime: "application/pdf", size: 200 };
  const created = await attachments.createProject(user, projectId,
    { name: "escaneado.pdf", file, chunks: [], status: "no-text", truncated: false });
  t.after(() => attachments.removeProject(user, projectId, created.id));
  const extracted = { chunks: [{ chunkIndex: 0, pageNumber: null, content: "Texto visible" }],
    status: "ready", truncated: true };
  assert.equal(await attachments.updateProjectExtraction({ id: 915, role: "AUDITOR" },
    projectId, created.id, extracted), null);
  assert.equal(await attachments.updateProjectExtraction(user,
    "22222222-2222-4222-8222-222222222222", created.id, extracted), null);
  assert.equal((await attachments.updateProjectExtraction(user, projectId, created.id, extracted)).status, "ready");
  assert.equal(await attachments.updateProjectExtraction(user, projectId, created.id, extracted), null);
  assert.equal((await attachments.getProject(user, projectId, created.id)).chunks.length, 1);
});

test("OCR PDF: la ruta exige dueño y bandera antes de descargar y llamar a Azure", async (t) => {
  const keys = ["VERA_USER_STORE", "VERA_AI_ENABLED", "VERA_AI_CONVERSATIONS_ENABLED",
    "VERA_AI_PROJECTS_ENABLED", "VERA_AI_ATTACHMENTS_ENABLED", "VERA_AI_PROJECT_FILES_ENABLED",
    "VERA_AI_PDF_OCR_ENABLED", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_OCR_DEPLOYMENT"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  Object.assign(process.env, { VERA_USER_STORE: "memory", VERA_AI_ENABLED: "true",
    VERA_AI_CONVERSATIONS_ENABLED: "true", VERA_AI_PROJECTS_ENABLED: "true",
    VERA_AI_ATTACHMENTS_ENABLED: "true", VERA_AI_PROJECT_FILES_ENABLED: "true",
    VERA_AI_PDF_OCR_ENABLED: "true", SUPABASE_URL: "https://supabase.example",
    SUPABASE_SECRET_KEY: "sb_secret_test_only", AZURE_OPENAI_ENDPOINT: "https://vera-test.openai.azure.com",
    AZURE_OPENAI_API_KEY: "test-only-key", AZURE_OPENAI_DEPLOYMENT: "vera-chat",
    AZURE_OPENAI_OCR_DEPLOYMENT: "vera-ocr" });
  t.after(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const pdf = await makePdf(3);
  let storageCalls = 0;
  let modelCalls = 0;
  global.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "supabase.example") {
      storageCalls += 1;
      return new Response(pdf, { headers: { "Content-Length": String(pdf.length) } });
    }
    if (url.hostname === "vera-test.openai.azure.com") {
      modelCalls += 1;
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text",
        text: "Revisión del proveedor X pendiente." }] }] });
    }
    return originalFetch(input, options);
  };
  const auth = (id, method = "GET", body) => ({ method, headers: {
    Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
    ...(body ? { "Content-Type": "application/json" } : {})
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const base = await startTestServer(t, app);
  const project = (await (await originalFetch(`${base}/api/assistant/projects`,
    auth(5, "POST", { name: "OCR privado" }))).json()).project;
  const user = { id: 5, role: "AUDITOR" };
  const created = await attachments.createProject(user, project.id,
    { name: "escaneado.pdf", file: { bucket: "vera-evidence",
      path: `ai/${project.id}/${randomUUID()}.pdf`, mime: "application/pdf", size: pdf.length },
    chunks: [], status: "no-text", truncated: false });
  t.after(() => attachments.removeProject(user, project.id, created.id));
  const path = `${base}/api/assistant/projects/${project.id}/files/${created.id}/ocr`;
  assert.equal((await originalFetch(path, auth(4, "POST"))).status, 404);
  assert.equal(storageCalls, 0);
  assert.equal(modelCalls, 0);
  const response = await originalFetch(path, auth(5, "POST"));
  assert.equal(response.status, 200);
  const saved = (await response.json()).file;
  assert.equal(saved.status, "ready");
  assert.equal(saved.truncated, true);
  assert.equal(storageCalls, 1);
  assert.equal(modelCalls, 1);
  assert.equal((await originalFetch(path, auth(5, "POST"))).status, 409);
  process.env.VERA_AI_PDF_OCR_ENABLED = "false";
  assert.equal((await originalFetch(path, auth(5, "POST"))).status, 503);
});
