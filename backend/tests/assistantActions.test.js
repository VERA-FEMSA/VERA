const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-action-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const riskRepository = require("../repositories/riskRepository");
const { createAction, getAction, changeStatus } = require("../services/actionService");
const { parseCompletion, parseStatusChange, parseReassignment } = require("../services/assistantActionService");

const options = (id, body) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify(body) });
const user = { id: 5, role: "AUDITOR", username: "auditor", name: "Auditor de prueba" };

const setup = async () => {
  const risk = riskRepository.create({ title: `Riesgo conversacional ${Date.now()}`, ownerId: 5,
    level: "Alto", score: 6, likelihood: 3, impact: 2, createdBy: { id: 3 } });
  const action = await createAction(user, { sourceType: "RISK", sourceId: risk.id,
    title: `Revisar expediente ${risk.id}`, rationale: "Se requiere documentar el seguimiento.",
    dueDate: "2026-11-20", assigneeId: 5 });
  return action;
};

test("La instrucción de completar exige motivo y título concreto", () => {
  assert.deepEqual(parseCompletion("Completa el compromiso «Revisar evidencia» porque la revisión quedó documentada."),
    { target: "Revisar evidencia", note: "la revisión quedó documentada." });
  assert.equal(parseCompletion("¿Qué compromisos tengo?"), null);
  assert.equal(parseStatusChange("Inicia el compromiso «Revisar evidencia» porque ya comenzó la revisión.").status,
    "IN_PROGRESS");
  assert.equal(parseStatusChange("Cancela el compromiso «Revisar evidencia» porque ya no aplica.").status,
    "CANCELLED");
  assert.equal(parseStatusChange("Reabre el compromiso «Revisar evidencia» porque falta comprobarlo.").status,
    "OPEN");
  assert.deepEqual(parseReassignment("Reasigna el compromiso «Revisar evidencia» a «Jefatura Demo» porque cambió la responsabilidad."),
    { target: "Revisar evidencia", assignee: "Jefatura Demo", note: "cambió la responsabilidad." });
});

test("El chat reasigna sólo a responsables autorizados y exige confirmación vigente", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const admin = { id: 1, role: "SUPER_ADMIN", username: "superadmin", name: "Admin de prueba" };
  const risk = riskRepository.create({ title: `Riesgo reasignación ${Date.now()}`, ownerId: 5,
    level: "Alto", score: 6, likelihood: 3, impact: 2, createdBy: { id: 1 } });
  const action = await createAction(admin, { sourceType: "RISK", sourceId: risk.id,
    title: `Seguimiento de responsable ${risk.id}`, rationale: "Asignar al responsable adecuado.",
    dueDate: "2026-11-20", assigneeId: 5 });
  const assignees = await fetch(`${base}/api/assistant/ask`, options(1,
    { question: `Lista responsables para el compromiso ${action.id}` }));
  assert.equal(assignees.status, 200);
  assert.match((await assignees.json()).answer, /Jefatura Demo/);
  const created = await fetch(`${base}/api/assistant/conversations`, options(1, { focus: null }));
  const { conversation } = await created.json();
  const url = `${base}/api/assistant/conversations/${conversation.id}/ask`;
  const command = `Reasigna el compromiso ${action.id} a Jefatura Demo porque asumirá el seguimiento del caso.`;
  const preview = await fetch(url, options(1, { question: command }));
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await getAction(admin, action.id)).assigneeId, 5);
  const confirmed = await fetch(url, options(1, { question: "Confirmar cambio" }));
  assert.equal((await confirmed.json()).message.mode, "action-executed");
  const moved = await getAction(admin, action.id);
  assert.equal(moved.assigneeId, 4);
  assert.equal(moved.history.at(-1).type, "REASSIGNED");
  const forbidden = await fetch(`${base}/api/assistant/conversations`, options(4, { focus: null }));
  const otherThread = (await forbidden.json()).conversation;
  const denied = await fetch(`${base}/api/assistant/conversations/${otherThread.id}/ask`, options(4,
    { question: `Reasigna el compromiso ${action.id} a Auditor Demo porque lo reasigno sin autorización.` }));
  assert.equal((await denied.json()).message.mode, "action-guidance");
  assert.equal((await getAction(admin, action.id)).assigneeId, 4);
  const stalePreview = await fetch(url, options(1,
    { question: `Reasigna el compromiso ${action.id} a Auditor Demo porque el responsable cambió nuevamente.` }));
  assert.equal((await stalePreview.json()).message.mode, "action-preview");
  await changeStatus(admin, action.id, { status: "IN_PROGRESS", note: "Se inició el seguimiento.",
    version: moved.storageVersion });
  const stale = await fetch(url, options(1, { question: "Confirmar cambio" }));
  assert.match((await stale.json()).message.text, /cambiaron/);
  assert.equal((await getAction(admin, action.id)).assigneeId, 4);
});

test("El chat aplica sólo las transiciones permitidas y permite consultar compromisos cerrados", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const manager = { id: 3, role: "GERENTE", username: "gerente", name: "Gerente de prueba" };
  const risk = riskRepository.create({ title: `Riesgo de transición ${Date.now()}`, ownerId: 3,
    level: "Alto", score: 6, likelihood: 3, impact: 2, createdBy: { id: 3 } });
  const action = await createAction(manager, { sourceType: "RISK", sourceId: risk.id,
    title: `Verificar transición ${risk.id}`, rationale: "Validar las transiciones con bitácora.",
    dueDate: "2026-11-20", assigneeId: 3 });
  const created = await fetch(`${base}/api/assistant/conversations`, options(3, { focus: null }));
  const { conversation } = await created.json();
  const url = `${base}/api/assistant/conversations/${conversation.id}/ask`;
  for (const [verb, status] of [["Inicia", "IN_PROGRESS"], ["Cancela", "CANCELLED"],
    ["Reabre", "OPEN"], ["Completa", "DONE"]]) {
    const preview = await fetch(url, options(3,
      { question: `${verb} el compromiso ${action.id} porque se registró una decisión verificable.` }));
    assert.equal((await preview.json()).message.mode, "action-preview");
    const confirmed = await fetch(url, options(3, { question: "Confirmar cambio" }));
    assert.equal((await confirmed.json()).message.mode, "action-executed");
    assert.equal((await getAction(manager, action.id)).status, status);
  }
  const closed = await fetch(url, options(3, { question: "Muéstrame mis compromisos cerrados" }));
  assert.ok((await closed.json()).message.browse.items.some((item) => item.id === action.id));
  assert.equal((await getAction(manager, action.id)).history.length, 5);
});

test("La conversación previsualiza, confirma una sola vez y registra el cambio autorizado", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const action = await setup();
  const otherCreated = await fetch(`${base}/api/assistant/conversations`, options(4, { focus: null }));
  const otherThread = (await otherCreated.json()).conversation;
  const otherRequest = await fetch(`${base}/api/assistant/conversations/${otherThread.id}/ask`, options(4,
    { question: `Completa el compromiso ${action.id} porque ya se revisó la evidencia.` }));
  assert.equal(otherRequest.status, 200);
  assert.equal((await otherRequest.json()).message.mode, "action-guidance");
  assert.equal((await getAction(user, action.id)).status, "OPEN");
  const created = await fetch(`${base}/api/assistant/conversations`, options(5, { focus: null }));
  assert.equal(created.status, 201);
  const { conversation } = await created.json();
  const url = `${base}/api/assistant/conversations/${conversation.id}/ask`;
  const listed = await fetch(url, options(5, { question: "Muéstrame mis compromisos" }));
  assert.equal(listed.status, 200);
  const listing = await listed.json();
  assert.equal(listing.message.mode, "browse");
  assert.ok(listing.message.browse.items.some((item) => item.id === action.id &&
    item.facts.some((fact) => fact.label === "Identificador" && fact.value === action.id)));
  const preview = await fetch(url, options(5, { question: `Completa el compromiso «${action.title}» porque ya se revisó la evidencia.` }));
  assert.equal(preview.status, 200);
  const previewBody = await preview.json();
  assert.equal(previewBody.message.mode, "action-preview");
  assert.equal((await getAction(user, action.id)).status, "OPEN");
  assert.equal((await fetch(url, options(4, { question: "Confirmar cambio" }))).status, 404);
  const confirmed = await fetch(url, options(5, { question: "Confirmar cambio" }));
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).message.mode, "action-executed");
  const finished = await getAction(user, action.id);
  assert.equal(finished.status, "DONE");
  assert.equal(finished.history.at(-1).note, "ya se revisó la evidencia.");
  const repeated = await fetch(url, options(5, { question: "Confirmar cambio" }));
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).message.mode, "action-guidance");
  assert.equal((await getAction(user, action.id)).history.length, finished.history.length);
});

test("Un cambio externo invalida la vista previa y el chat sin historial nunca escribe", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const action = await setup();
  const created = await fetch(`${base}/api/assistant/conversations`, options(5, { focus: null }));
  const { conversation } = await created.json();
  const url = `${base}/api/assistant/conversations/${conversation.id}/ask`;
  assert.equal((await fetch(url, options(5, { question: `Completa el compromiso ${action.id} porque ya se revisó la evidencia.` }))).status, 200);
  await changeStatus(user, action.id, { status: "IN_PROGRESS", note: "El trabajo sigue en revisión.",
    version: action.storageVersion });
  const stale = await fetch(url, options(5, { question: "Confirmar cambio" }));
  assert.equal(stale.status, 200);
  assert.match((await stale.json()).message.text, /cambió/);
  assert.equal((await getAction(user, action.id)).status, "IN_PROGRESS");
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(5,
    { question: `Completa el compromiso ${action.id} porque ya se revisó la evidencia.` }));
  assert.equal(ephemeral.status, 200);
  assert.equal((await ephemeral.json()).mode, "action-guidance");
  const readOnlyList = await fetch(`${base}/api/assistant/ask`, options(5,
    { question: "Muéstrame mis compromisos" }));
  assert.equal(readOnlyList.status, 200);
  assert.equal((await readOnlyList.json()).mode, "browse");
  assert.equal((await getAction(user, action.id)).status, "IN_PROGRESS");
});
