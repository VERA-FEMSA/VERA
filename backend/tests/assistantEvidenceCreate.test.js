const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-evidence-create-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const evidenceRepository = require("../repositories/evidenceRepository");
const userRepository = require("../repositories/userRepository");
const { parseFields } = require("../services/assistantEvidenceCreateService");

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
const fields = (title, reference = "https://example.com/vera-acta") =>
  `Título: ${title}\nDescripción: Documento que respalda la revisión del proceso auditado\nTipo: documento\nReferencia: ${reference}\nEntidad: auditoría\nIdentificador: AUD-01`;
const enableConversations = (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
};

test("Registro conversacional de evidencia exige campos explícitos", () => {
  assert.equal(parseFields(fields("Acta A")).fields.entityType, "AUDIT");
  assert.equal(parseFields(fields("Acta A")).fields.evidenceType, "DOCUMENT");
  assert.match(parseFields("Título: Acta A").error, /Faltan campos/);
  assert.match(parseFields(`${fields("Acta A")}\nTítulo: Otro`).error, /sin repetirlos/);
});

test("Gerente registra referencia de evidencia tras vista previa y confirmación", async (context) => {
  enableConversations(context);
  const base = await startTestServer(context, app);
  const url = await conversation(base, 3);
  const title = `Acta chat ${Date.now()}`;
  const before = (await evidenceRepository.getAll()).length;
  assert.match((await (await ask(url, 3, "Registrar evidencia")).json()).message.text, /Referencia:/);
  const preview = await ask(url, 3, fields(title));
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await evidenceRepository.getAll()).length, before);
  const confirmed = await ask(url, 3, "Confirmar evidencia");
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.equal(result.message.mode, "action-executed");
  assert.equal(result.historySaved, true);
  const evidence = await evidenceRepository.findById(result.message.actionOutcome.id);
  assert.equal(evidence.title, title);
  assert.equal(evidence.entityType, "AUDIT");
  assert.equal(evidence.entityId, "AUD-01");
  assert.equal(evidence.author.id, 3);
  assert.equal((await evidenceRepository.getAll()).length, before + 1);
  assert.equal((await (await ask(url, 3, "Confirmar evidencia")).json()).message.mode, "action-guidance");
});

test("Permisos, referencias inseguras y confirmaciones paralelas no crean datos indebidos", async (context) => {
  enableConversations(context);
  const base = await startTestServer(context, app);
  const directorUrl = await conversation(base, 2);
  assert.match((await (await ask(directorUrl, 2, `Registrar evidencia\n${fields("Negada")}`)).json()).message.text,
    /no registrarlas/);
  const auditorUrl = await conversation(base, 5);
  assert.match((await (await ask(auditorUrl, 5, `Registrar evidencia\n${fields("Fuera de alcance")}`)).json()).message.text,
    /no existe/);
  const url = await conversation(base, 1);
  const before = (await evidenceRepository.getAll()).length;
  assert.match((await (await ask(url, 1, `Registrar evidencia\n${fields("Insegura", "javascript:alert(1)")}`)).json()).message.text,
    /referencia/);
  assert.equal((await evidenceRepository.getAll()).length, before);
  const title = `Acta concurrente ${Date.now()}`;
  assert.equal((await (await ask(url, 1, `Registrar evidencia\n${fields(title)}`)).json()).message.mode,
    "action-preview");
  const parallel = await Promise.all([ask(url, 1, "Confirmar evidencia"), ask(url, 1, "Confirmar evidencia")]);
  assert.ok(parallel.some((response) => response.status === 200));
  assert.equal((await evidenceRepository.getAll()).filter((item) => item.title === title).length, 1);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(1,
    { question: `Registrar evidencia\n${fields("Solo lectura")}` }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});

test("Si cambia el rol entre vista previa y confirmación, no se registra la evidencia", async (context) => {
  enableConversations(context);
  const base = await startTestServer(context, app);
  const url = await conversation(base, 3);
  const title = `Acta cambio de rol ${Date.now()}`;
  assert.equal((await (await ask(url, 3, `Registrar evidencia\n${fields(title)}`)).json()).message.mode,
    "action-preview");
  userRepository.updateRole(3, "DIRECTOR");
  try {
    const confirmed = await ask(url, 3, "Confirmar evidencia");
    assert.ok([401, 403, 404, 409].includes(confirmed.status), `HTTP ${confirmed.status}`);
    assert.equal((await evidenceRepository.getAll()).some((item) => item.title === title), false);
  } finally { userRepository.updateRole(3, "GERENTE"); }
});
