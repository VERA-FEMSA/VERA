const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-role-review-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const roleRequests = require("../repositories/roleRequestRepository");
const userRepository = require("../repositories/userRepository");
const { parseDecision } = require("../services/assistantRoleReviewService");

const auth = (id, method, body) => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body === undefined ? {} : { "Content-Type": "application/json" })
}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const conversation = async (base, id) => {
  const result = await fetch(`${base}/api/assistant/conversations`, auth(id, "POST", { focus: null }));
  assert.equal(result.status, 201);
  return (await result.json()).conversation.id;
};
const ask = (base, id, threadId, question) => fetch(`${base}/api/assistant/conversations/${threadId}/ask`,
  auth(id, "POST", { question }));

test("El comando distingue aprobación de rechazo y exige ID numérico", () => {
  assert.deepEqual(parseDecision("Aprueba solicitud de rol #31"), { approve: true, requestId: 31 });
  assert.deepEqual(parseDecision("Rechaza solicitud de rol 32"), { approve: false, requestId: 32 });
  assert.equal(parseDecision("Aprueba solicitud de rol"), null);
});

test("Super Admin revisa una solicitud real desde el chat y el rol cambia una sola vez", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous;
    userRepository.updateRole(5, "AUDITOR"); });
  const base = await startTestServer(context, app);
  const request = await roleRequests.create({ userId: 5, requestedRole: "GERENTE",
    reason: "Necesito gestionar los riesgos del portafolio." });
  const adminThread = await conversation(base, 1);
  const nonAdminThread = await conversation(base, 5);
  const denied = await ask(base, 5, nonAdminThread, "Solicitudes de rol pendientes");
  assert.equal((await denied.json()).message.mode, "action-guidance");
  assert.doesNotMatch((await (await ask(base, 5, nonAdminThread,
    `Aprueba solicitud de rol #${request.id}`)).json()).message.text, /gestionar los riesgos/);
  const list = await ask(base, 1, adminThread, "Solicitudes de rol pendientes");
  assert.match((await list.json()).message.text, new RegExp(`#${request.id}`));
  const next = await ask(base, 1, adminThread, "Siguientes solicitudes de rol");
  assert.match((await next.json()).message.text, /Ya no hay más solicitudes/);
  const preview = await ask(base, 1, adminThread, `Aprueba solicitud de rol #${request.id}`);
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await userRepository.findById(5)).role, "AUDITOR");
  const confirmed = await ask(base, 1, adminThread, "Confirmar revisión de rol");
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.equal(result.message.mode, "action-executed", result.message.text);
  assert.equal(result.historySaved, true);
  assert.equal((await userRepository.findById(5)).role, "GERENTE");
  const stored = (await roleRequests.listMine(5)).find((item) => item.id === request.id);
  assert.equal(stored.status, "APPROVED");
  assert.equal(stored.reviewedBy, 1);
  const again = await ask(base, 1, adminThread, "Confirmar revisión de rol");
  assert.equal((await again.json()).message.mode, "action-guidance");
});

test("Una vista previa no permite aprobar si el rol del solicitante cambia", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous;
    userRepository.updateRole(4, "JEFATURA"); });
  const base = await startTestServer(context, app);
  const request = await roleRequests.create({ userId: 4, requestedRole: "DIRECTOR",
    reason: "Necesito ver reportes ejecutivos del portafolio." });
  const thread = await conversation(base, 1);
  const preview = await ask(base, 1, thread, `Aprueba solicitud de rol #${request.id}`);
  assert.equal((await preview.json()).message.mode, "action-preview");
  await userRepository.updateRole(4, "GERENTE");
  const confirmation = await ask(base, 1, thread, "Confirmar revisión de rol");
  assert.equal((await confirmation.json()).message.mode, "action-guidance");
  assert.equal((await userRepository.findById(4)).role, "GERENTE");
  assert.equal((await roleRequests.listMine(4)).find((item) => item.id === request.id).status, "PENDING");
  const rejectedPreview = await ask(base, 1, thread, `Rechaza solicitud de rol #${request.id}`);
  assert.equal((await rejectedPreview.json()).message.mode, "action-preview");
  const rejected = await ask(base, 1, thread, "Confirmar revisión de rol");
  assert.equal((await rejected.json()).message.mode, "action-executed");
  assert.equal((await roleRequests.listMine(4)).find((item) => item.id === request.id).status, "REJECTED");
  assert.equal((await userRepository.findById(4)).role, "GERENTE");
});
