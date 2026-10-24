const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-role-request-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { parseRequest, handleRoleRequest } = require("../services/assistantRoleRequestService");
const roleRequests = require("../repositories/roleRequestRepository");
const userRepository = require("../repositories/userRepository");

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

test("La solicitud de rol exige formato y conserva el motivo original", () => {
  assert.deepEqual(parseRequest("Solicita rol GERENTE porque Necesito revisar áreas críticas."),
    { role: "GERENTE", reason: "Necesito revisar áreas críticas." });
  assert.equal(parseRequest("Solicita rol super admin porque quiero todo"), null);
});

test("Si se pierde la respuesta del chat, repetir la confirmación no crea otra solicitud", async () => {
  const actor = { id: 2, role: "DIRECTOR" };
  const preview = await handleRoleRequest(actor,
    "Solicita rol AUDITOR porque Necesito trabajar solo con expedientes asignados.", { messages: [] });
  assert.equal(preview.mode, "action-preview");
  const thread = { messages: [{ actionDraft: preview.actionDraft }] };
  const first = await handleRoleRequest(actor, "Confirmar solicitud de rol", thread);
  const retried = await handleRoleRequest(actor, "Confirmar solicitud de rol", thread);
  assert.equal(first.mode, "action-executed");
  assert.equal(retried.mode, "action-executed");
  assert.equal(first.actionOutcome.id, retried.actionOutcome.id);
  assert.equal((await roleRequests.listMine(2)).filter((item) => item.status === "PENDING").length, 1);
});

test("El chat muestra vista previa, confirma una vez y mantiene los permisos", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const url = await conversation(base, 5);
  const command = "Solicita rol GERENTE porque Necesito revisar riesgos del portafolio.";
  const preview = await ask(url, 5, command);
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal(userRepository.findById(5).role, "AUDITOR");
  const confirmed = await ask(url, 5, "Confirmar solicitud de rol");
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).message.mode, "action-executed");
  assert.equal(userRepository.findById(5).role, "AUDITOR");
  const mine = await roleRequests.listMine(5);
  assert.equal(mine.filter((item) => item.status === "PENDING").length, 1);
  assert.equal(mine[0].reason, "Necesito revisar riesgos del portafolio.");
  assert.equal((await (await ask(url, 5, "Confirmar solicitud de rol")).json()).message.mode,
    "action-guidance");
  assert.match((await (await ask(url, 5, "Mis solicitudes de rol")).json()).message.text,
    /PENDING/);
  assert.match((await (await ask(url, 5, command)).json()).message.text,
    /solicitud de rol pendiente/);
});

test("El chat no permite solicitar Super Admin ni confirmar si cambió el acceso", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const adminUrl = await conversation(base, 1);
  assert.match((await (await ask(adminUrl, 1,
    "Solicita rol director porque Quiero consultar reportes ejecutivos.")).json()).message.text,
  /administración máxima/);
  const url = await conversation(base, 4);
  assert.equal((await (await ask(url, 4,
    "Solicita rol director porque Necesito consultar los reportes ejecutivos.")).json()).message.mode,
  "action-preview");
  userRepository.updateRole(4, "GERENTE");
  t.after(() => userRepository.updateRole(4, "JEFATURA"));
  const result = await ask(url, 4, "Confirmar solicitud de rol");
  assert.ok([404, 409].includes(result.status));
  assert.equal((await roleRequests.listMine(4)).filter((item) => item.status === "PENDING").length, 0);
});
