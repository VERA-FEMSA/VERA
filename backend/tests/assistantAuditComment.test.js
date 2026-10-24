const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-audit-comment-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const commentRepository = require("../repositories/commentRepository");
const userRepository = require("../repositories/userRepository");
const { parseCommand } = require("../services/assistantAuditCommentService");

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
const enableConversations = (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
};

test("Comentario exige expediente exacto y texto explícito", () => {
  assert.deepEqual(parseCommand("Comenta la auditoría AUD-01: Revisión documentada."), {
    proposalId: "AUD-01", text: "Revisión documentada." });
  assert.equal(parseCommand("Comenta la auditoría: Revisión documentada."), null);
});

test("Gerente comenta una auditoría tras confirmar y deja la bitácora", async (context) => {
  enableConversations(context);
  const base = await startTestServer(context, app);
  const url = await conversation(base, 3);
  const text = `Revisión documentada en el expediente ${Date.now()}.`;
  const before = (await commentRepository.listByProposal("AUD-01")).length;
  const preview = await ask(url, 3, `Comenta la auditoría AUD-01: ${text}`);
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await commentRepository.listByProposal("AUD-01")).length, before);
  const confirmed = await ask(url, 3, "Confirmar comentario");
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.equal(result.message.mode, "action-executed");
  assert.equal(result.historySaved, true);
  const comments = await commentRepository.listByProposal("AUD-01");
  assert.equal(comments.length, before + 1);
  assert.equal(comments.at(-1).text, text);
  assert.equal(comments.at(-1).author.id, 3);
  assert.equal((await (await ask(url, 3, "Confirmar comentario")).json()).message.mode, "action-guidance");
  const history = await fetch(`${base}/api/planning/AUD-01/history`, {
    headers: { Authorization: `Bearer ${jwt.sign({ id: 3 }, process.env.JWT_SECRET)}` } });
  assert.equal(history.status, 200);
  assert.ok((await history.json()).history.some((item) => item.action === "AUDIT_COMMENT_ADDED"));
});

test("Rol, expediente ajeno, duplicación y chat sin historial mantienen límites", async (context) => {
  enableConversations(context);
  const base = await startTestServer(context, app);
  const directorUrl = await conversation(base, 2);
  assert.match((await (await ask(directorUrl, 2,
    "Comenta la auditoría AUD-01: Comentario que no debe guardarse.")).json()).message.text,
  /no agregar comentarios/);
  const auditorUrl = await conversation(base, 5);
  assert.match((await (await ask(auditorUrl, 5,
    "Comenta la auditoría AUD-01: Comentario fuera de alcance.")).json()).message.text,
  /no encontrada/);
  const url = await conversation(base, 1);
  const before = (await commentRepository.listByProposal("AUD-01")).length;
  assert.match((await (await ask(url, 1, "Comenta la auditoría AUD-01: x")).json()).message.text,
    /entre 3 y 2,000/);
  assert.equal((await commentRepository.listByProposal("AUD-01")).length, before);
  const text = `Confirmación concurrente ${Date.now()}.`;
  assert.equal((await (await ask(url, 1, `Comenta la auditoría AUD-01: ${text}`)).json()).message.mode,
    "action-preview");
  const parallel = await Promise.all([ask(url, 1, "Confirmar comentario"), ask(url, 1, "Confirmar comentario")]);
  assert.ok(parallel.some((response) => response.status === 200));
  assert.equal((await commentRepository.listByProposal("AUD-01")).filter((item) => item.text === text).length, 1);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(1,
    { question: "Comenta la auditoría AUD-01: Consulta sin historial." }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});

test("Cambio de rol entre vista previa y confirmación impide escribir", async (context) => {
  enableConversations(context);
  const base = await startTestServer(context, app);
  const url = await conversation(base, 3);
  const text = `Sin autorización tras cambio de rol ${Date.now()}.`;
  assert.equal((await (await ask(url, 3, `Comenta la auditoría AUD-01: ${text}`)).json()).message.mode,
    "action-preview");
  userRepository.updateRole(3, "DIRECTOR");
  try {
    const confirmed = await ask(url, 3, "Confirmar comentario");
    assert.ok([401, 403, 404, 409].includes(confirmed.status), `HTTP ${confirmed.status}`);
    assert.equal((await commentRepository.listByProposal("AUD-01")).some((item) => item.text === text), false);
  } finally { userRepository.updateRole(3, "GERENTE"); }
});
