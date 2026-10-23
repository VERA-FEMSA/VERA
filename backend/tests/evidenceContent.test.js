const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const fs = require("node:fs");
const path = require("node:path");
const { PDFDocument } = require("pdf-lib");

process.env.JWT_SECRET ||= "evidence-content-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { extractEvidenceText, makePdfChunks } = require("../services/evidenceTextExtraction");
const { paragraphsFromXml } = require("../services/docxTextExtraction");
const evidenceTextIndex = require("../repositories/evidenceTextIndex");
const { askEvidenceContent, asksForCompleteDocument, selectChunks } = require("../services/evidenceContentService");
const evidenceRepository = require("../repositories/evidenceRepository");
const riskRepository = require("../repositories/riskRepository");

const auth = (id) => ({ Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json" });

const samplePdf = (content) => {
  const stream = `BT /F1 12 Tf 72 720 Td (${content}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { body += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
};

test("Evidencias IA: extrae UTF-8 y páginas PDF sin superar los límites", async () => {
  const plain = await extractEvidenceText(Buffer.from("Control de acceso revisado.\nSin excepciones."), "text/plain");
  assert.equal(plain.status, "ready");
  assert.equal(plain.chunks[0].pageNumber, null);
  assert.match(plain.chunks[0].content, /Sin excepciones/);
  const pdf = await extractEvidenceText(samplePdf("Hallazgo documentado"), "application/pdf");
  assert.equal(pdf.status, "ready");
  assert.equal(pdf.chunks[0].pageNumber, 1);
  assert.match(pdf.chunks[0].content, /Hallazgo documentado/);
  const imageOnly = await PDFDocument.create();
  imageOnly.addPage([200, 200]);
  const scanned = await extractEvidenceText(Buffer.from(await imageOnly.save()), "application/pdf");
  assert.equal(scanned.status, "no-text");
  assert.equal(scanned.chunks.length, 0);
  const capped = makePdfChunks([{ pageNumber: 1, text: "A".repeat(40_000) }], 2);
  assert.equal(capped.status, "ready");
  assert.equal(capped.truncated, true);
  assert.equal(capped.chunks.length, 50);
  assert.equal(makePdfChunks([{ pageNumber: 1, text: "Control completo" }], 1).truncated, false);
  const long = await extractEvidenceText(Buffer.from("A ".repeat(25_000)), "text/plain");
  assert.equal(long.truncated, true);
  assert.ok(long.chunks.length <= 50);
  assert.ok(long.chunks.every((item) => item.content.length <= 800));
  assert.equal((await extractEvidenceText(Buffer.from("imagen"), "image/png")).status, "unsupported");
});

test("Evidencias IA: interpreta CSV UTF-8 con encabezados, comillas y límites", async () => {
  const csv = Buffer.from('\uFEFFControl,Resultado,Responsable\r\n"Acceso, privilegiado","Aprobado; sin excepción",Ana\r\nInventario,Pendiente,Luis\r\n');
  const parsed = await extractEvidenceText(csv, "text/csv");
  assert.equal(parsed.status, "ready");
  assert.equal(parsed.truncated, false);
  assert.match(parsed.chunks[0].content, /Fila 2: Control: Acceso, privilegiado/);
  assert.match(parsed.chunks[0].content, /Resultado: Aprobado; sin excepción/);
  assert.match(parsed.chunks[1].content, /Fila 3: Control: Inventario/);
  assert.equal(parsed.chunks[0].pageNumber, null);
  await assert.rejects(() => extractEvidenceText(Buffer.from("A,B\n1"), "text/csv"), /Invalid Record Length|mismo número/);
  await assert.rejects(() => extractEvidenceText(Buffer.from([0xff, 0xfe]), "text/csv"));
  const long = await extractEvidenceText(Buffer.from(`Campo,Estado\n${"a,ok\n".repeat(1001)}`), "text/csv");
  assert.equal(long.truncated, true);
  assert.ok(long.chunks.every((item) => item.content.length <= 800));
});

test("Evidencias IA: DOCX extrae solo texto vigente y limita archivos comprimidos", async () => {
  const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name));
  const docx = await extractEvidenceText(fixture("sample-evidence.docx"), mime);
  assert.equal(docx.status, "ready");
  assert.equal(docx.truncated, false);
  assert.ok(docx.chunks.some((item) => item.content.includes("Revisión trimestral sin excepción")));
  assert.ok(docx.chunks.every((item) => item.pageNumber === null));
  assert.ok(!JSON.stringify(docx).includes("Texto eliminado confidencial"));
  await assert.rejects(() => extractEvidenceText(fixture("oversized-evidence.docx"), mime), /límite/);
  await assert.rejects(() => extractEvidenceText(Buffer.from("PK\\x03\\x04invalid"), mime));
  assert.throws(() => paragraphsFromXml("<!DOCTYPE x><x/>"), /DTD/);
  assert.throws(() => paragraphsFromXml("<w:document>"));
  const long = paragraphsFromXml(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>${"A".repeat(40_100)}</w:t></w:r></w:p></w:document>`);
  assert.equal(long.truncated, true);
  assert.equal(long.pages[0].text.length, 40_000);
});

test("Evidencias IA: recupera solo fragmentos relevantes y exige una cita del archivo", async () => {
  const id = "EVD-TEST-CONTENT-1";
  await evidenceTextIndex.replace(id, [
    { chunkIndex: 0, pageNumber: 1, content: "El acceso a proveedores requiere autorización del gerente." },
    { chunkIndex: 1, pageNumber: 2, content: "La revisión de pagos se realizó en septiembre." }
  ]);
  assert.equal(selectChunks(await evidenceTextIndex.get(id), "¿Qué dice sobre proveedores?").length, 1);
  const evidence = { id, title: "Informe de control", file: { mime: "application/pdf" } };
  const result = await askEvidenceContent(evidence, "¿Qué dice sobre proveedores?", "AUDITOR", { ask: async ({ context }) => {
    assert.equal(context.records.evidence.length, 1);
    assert.ok(context.records.evidence[0].text.includes("proveedores"));
    return { answer: "Se requiere autorización del gerente.", sourceIds: [`evidence:${id}:chunk:0`],
      usage: { prompt_tokens: 80, completion_tokens: 15 } };
  } });
  assert.equal(result.mode, "generated");
  assert.equal(result.citations[0].pageNumber, 1);
  assert.equal(result.coverage.partial, true);
  const uncited = await askEvidenceContent(evidence, "¿Qué dice sobre proveedores?", "AUDITOR", {
    ask: async () => ({ answer: "Una afirmación sin respaldo.", sourceIds: [] })
  });
  assert.equal(uncited.mode, "uncited");
  assert.ok(!uncited.answer.includes("afirmación"));
  const missing = await askEvidenceContent(evidence, "¿Qué dice sobre criptografía?", "AUDITOR", {
    ask: async () => { throw new Error("No debe llamar a Azure sin coincidencias."); }
  });
  assert.equal(missing.mode, "no-match");
});

test("Evidencias IA: no calcula totales ni listas completas desde un índice acotado", async () => {
  const id = "EVD-TEST-SCOPE-1";
  await evidenceTextIndex.replace(id, [{ chunkIndex: 0, pageNumber: null,
    content: "Fila 2: Control: Acceso; Estado: Incumple." }]);
  const evidence = { id, title: "Matriz acotada", file: { mime: "text/csv" } };
  const noModel = { ask: async () => { throw new Error("No debe calcular un total con Azure."); } };
  for (const question of ["¿Cuántos controles incumplen en todo este archivo?",
    "Dame el total de controles", "Enumera todos los registros", "¿Cuál es el porcentaje de incumplimiento?",
    "¿Cuántos controles hay en todo el archivo, incluida la fila 2?"]) {
    const result = await askEvidenceContent(evidence, question, "AUDITOR", noModel);
    assert.equal(result.mode, "scope-limited");
    assert.equal(result.coverage.partial, true);
    assert.deepEqual(result.citations, []);
  }
  assert.equal(asksForCompleteDocument("¿Cuál es el estado de la fila 2?"), false);
  const specific = await askEvidenceContent(evidence, "¿Cuál es el estado de la fila 2?", "AUDITOR", {
    ask: async () => ({ answer: "Incumple.", sourceIds: [`evidence:${id}:chunk:0`] })
  });
  assert.equal(specific.mode, "generated");
});

test("Evidencias IA: archivo anterior se indexa bajo demanda desde Storage privado", async () => {
  const id = "EVD-TEST-LEGACY-1";
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  global.fetch = async (input, options) => {
    assert.equal(new URL(input).pathname.startsWith("/storage/v1/object/vera-evidence/"), true);
    assert.equal(options.headers.apikey, "sb_secret_test");
    return new Response("El control confirma la revisión mensual.", { headers: { "Content-Type": "text/plain" } });
  };
  try {
    const evidence = { id, title: "Documento heredado", file: { bucket: "vera-evidence",
      path: "risk/RSK-1/11111111-1111-1111-1111-111111111111.txt", mime: "text/plain", size: 42 } };
    const result = await askEvidenceContent(evidence, "¿Qué confirma el control?", "AUDITOR", {
      ask: async () => ({ answer: "Confirma la revisión mensual.", sourceIds: [`evidence:${id}:chunk:0`] })
    });
    assert.equal(result.mode, "generated");
    assert.equal((await evidenceTextIndex.get(id)).length, 1);
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of [["SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("Evidencias IA: el índice Supabase usa la clave de servidor y acota por evidencia", async () => {
  const previous = { mode: process.env.VERA_EVIDENCE_COMMENT_STORE, url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY };
  const originalFetch = global.fetch;
  process.env.VERA_EVIDENCE_COMMENT_STORE = "supabase";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  const id = "EVD-TEST-REMOTE-1";
  let writes = 0;
  global.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/rest/v1/vera_evidence_text_chunks");
    assert.equal(options.headers.apikey, "sb_secret_test");
    assert.equal(options.headers.Authorization, undefined);
    if (options.method === "POST") {
      writes += 1;
      assert.equal(url.searchParams.get("on_conflict"), "evidence_id,chunk_index");
      assert.equal(JSON.parse(options.body)[0].evidence_id, id);
      return new Response(null, { status: 204 });
    }
    assert.equal(url.searchParams.get("evidence_id"), `eq.${id}`);
    return Response.json([{ chunk_index: 0, page_number: 2, content: "Texto privado indexado." }]);
  };
  try {
    assert.equal(await evidenceTextIndex.replace(id, [{ chunkIndex: 0, pageNumber: 2,
      content: "Texto privado indexado." }]), 1);
    assert.deepEqual(await evidenceTextIndex.get(id), [{ chunkIndex: 0, pageNumber: 2,
      content: "Texto privado indexado." }]);
    assert.equal(writes, 1);
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of [["VERA_EVIDENCE_COMMENT_STORE", previous.mode], ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("Evidencias IA: la API niega archivo ajeno antes de enviar texto al modelo", async (t) => {
  const base = await startTestServer(t, app);
  const previous = { enabled: process.env.VERA_AI_ENABLED, endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_API_KEY, deployment: process.env.AZURE_OPENAI_DEPLOYMENT };
  const originalFetch = global.fetch;
  process.env.VERA_AI_ENABLED = "true";
  process.env.AZURE_OPENAI_ENDPOINT = "https://vera-test.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key-only";
  process.env.AZURE_OPENAI_DEPLOYMENT = "vera-chat";
  const ownRisk = riskRepository.create({ title: "Riesgo con evidencia consultable", ownerId: 5,
    level: "Alto", score: 6, likelihood: 3, impact: 2, createdBy: { id: 3 } });
  const otherRisk = riskRepository.create({ title: "Riesgo privado ajeno", ownerId: 4,
    level: "Medio", score: 4, likelihood: 2, impact: 2, createdBy: { id: 3 } });
  const makeEvidence = (risk, label) => evidenceRepository.create({ title: label, description: "Informe privado del riesgo.",
    evidenceType: "REPORT", reference: "Archivo privado", entityType: "RISK", entityId: risk.id,
    entityTitle: risk.title, file: { bucket: "vera-evidence", mime: "text/plain", size: 35,
      path: `risk/${risk.id}/11111111-1111-1111-1111-111111111111.txt` },
    author: { id: 3, name: "Gerente", role: "GERENTE" } });
  const own = makeEvidence(ownRisk, "Informe visible");
  const other = makeEvidence(otherRisk, "Informe secreto ajeno");
  await evidenceTextIndex.replace(own.id, [{ chunkIndex: 0, pageNumber: null,
    content: "El control de acceso exige autorización previa." }]);
  await evidenceTextIndex.replace(other.id, [{ chunkIndex: 0, pageNumber: null,
    content: "SECRETO_AJENO no debe viajar al modelo." }]);
  let calls = 0;
  global.fetch = (input, options) => {
    if (new URL(input).hostname !== "vera-test.openai.azure.com") return originalFetch(input, options);
    calls += 1;
    const prompt = JSON.parse(options.body).messages[1].content;
    assert.ok(prompt.includes("autorización previa"));
    assert.ok(!prompt.includes("SECRETO_AJENO"));
    return Promise.resolve(Response.json({ choices: [{ message: { content: JSON.stringify({
      answer: "Requiere autorización previa.", sourceIds: [`evidence:${own.id}:chunk:0`]
    }) } }], usage: { prompt_tokens: 60, completion_tokens: 12 } }));
  };
  try {
    const path = (id) => `${base}/api/evidence/${id}/ask`;
    const body = JSON.stringify({ question: "¿Qué exige el control de acceso?" });
    assert.equal((await originalFetch(path(own.id), { method: "POST", body })).status, 401);
    assert.equal((await global.fetch(path(other.id), { method: "POST", headers: auth(5), body })).status, 404);
    assert.equal(calls, 0);
    const allowed = await global.fetch(path(own.id), { method: "POST", headers: auth(5), body });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    const data = await allowed.json();
    assert.equal(data.mode, "generated");
    assert.equal(data.citations[0].evidenceId, own.id);
    assert.equal(data.usage.promptTokens, 60);
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of [["VERA_AI_ENABLED", previous.enabled], ["AZURE_OPENAI_ENDPOINT", previous.endpoint],
      ["AZURE_OPENAI_API_KEY", previous.key], ["AZURE_OPENAI_DEPLOYMENT", previous.deployment]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
