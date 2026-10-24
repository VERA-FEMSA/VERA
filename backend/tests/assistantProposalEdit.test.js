const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-proposal-edit-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { parseProposalEdit } = require("../services/assistantProposalEditService");
const { createProposalForUser } = require("../services/proposalService");
const planningRepository = require("../repositories/planningRepository");

const manager = { id: 3, role: "GERENTE", username: "gerente" };
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
const fixture = () => createProposalForUser(manager, {
  title: `Propuesta edición ${Date.now()}-${Math.random()}`,
  objective: "Evaluar el control interno del área", scope: "Operaciones del trimestre",
  justification: "Hay cambios recientes que requieren revisión documentada.",
  area: "Operaciones", type: "Interna", quarter: "Q4", year: 2026
});

test("La edición exige ID, campo, valor explícito y motivo", () => {
  assert.deepEqual(parseProposalEdit("Edita la propuesta AUD-04: objetivo = «Revisar controles nuevos» porque cambió el alcance acordado."),
    { id: "AUD-04", field: "objective", value: "Revisar controles nuevos",
      reason: "cambió el alcance acordado." });
  assert.equal(parseProposalEdit("Edita todas las propuestas"), null);
});

test("El chat edita solo después de confirmar y conserva la bitácora", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const proposal = await fixture();
  const url = await conversation(base, 3);
  const command = `Edita la propuesta ${proposal.id}: objetivo = «Revisar controles críticos con evidencia» porque se amplió la revisión del trimestre.`;
  const preview = await ask(url, 3, command);
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).message.mode, "action-preview");
  assert.equal((await planningRepository.findById(proposal.id)).objective, proposal.objective);
  const confirmed = await ask(url, 3, "Confirmar edición de propuesta");
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).message.mode, "action-executed");
  assert.equal((await planningRepository.findById(proposal.id)).objective,
    "Revisar controles críticos con evidencia");
  assert.equal((await (await ask(url, 3, "Confirmar edición de propuesta")).json()).message.mode,
    "action-guidance");
});

test("Dirección y Jefatura ajena no pueden editar ni desde el chat ni la API", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const proposal = await fixture();
  const command = `Edita la propuesta ${proposal.id}: objetivo = «Cambiar el objetivo del área» porque queremos otra revisión.`;
  const directorUrl = await conversation(base, 2);
  assert.match((await (await ask(directorUrl, 2, command)).json()).message.text, /no puede editar/);
  const jefaturaUrl = await conversation(base, 4);
  assert.match((await (await ask(jefaturaUrl, 4, command)).json()).message.text, /Solo puedes editar/);
  assert.equal((await planningRepository.findById(proposal.id)).objective, proposal.objective);
});

test("Una propuesta modificada después de la vista previa no se sobrescribe", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const proposal = await fixture();
  const url = await conversation(base, 3);
  const command = `Edita la propuesta ${proposal.id}: objetivo = «Revisar controles críticos» porque cambiaron los criterios del proyecto.`;
  assert.equal((await (await ask(url, 3, command)).json()).message.mode, "action-preview");
  await planningRepository.update(proposal.id, { objective: "Objetivo actualizado por otra persona" },
    proposal.storageVersion);
  const result = await ask(url, 3, "Confirmar edición de propuesta");
  assert.match((await result.json()).message.text, /cambió desde la vista previa/);
  assert.equal((await planningRepository.findById(proposal.id)).objective,
    "Objetivo actualizado por otra persona");
});
