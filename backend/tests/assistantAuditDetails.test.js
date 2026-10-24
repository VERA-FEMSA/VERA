const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-audit-details-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const evidenceRepository = require("../repositories/evidenceRepository");
const { parse } = require("../services/assistantAuditDetailsService");

const options = (id, body) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify(body) });
const conversation = async (base, id) => {
  const response = await fetch(`${base}/api/assistant/conversations`, options(id, { focus: null }));
  assert.equal(response.status, 201);
  return `${base}/api/assistant/conversations/${(await response.json()).conversation.id}/ask`;
};
const ask = async (url, id, question) => (await (await fetch(url, options(id, { question }))).json()).message;

test("El comando conserva la capitalización exacta del ID", () => {
  assert.deepEqual(parse("Detalles de la auditoría AUD-02"), { id: "AUD-02", section: null });
  assert.deepEqual(parse("Más riesgos de la auditoría AUD-02"), { id: "AUD-02", section: "risks" });
  assert.equal(parse("Detalles sin ID"), null);
});

test("El chat recorre detalles y relaciones autorizadas de una auditoría sin usar el modelo", async (context) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  context.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(context, app);
  const linked = [];
  for (let i = 0; i < 4; i += 1) linked.push(riskRepository.create({
    title: `Riesgo detalle ${Date.now()}-${i}`, description: "Descripción de riesgo para expediente.",
    area: "Operaciones", ownerId: 3, ownerName: "Gerente", linkedAuditId: "AUD-02",
    likelihood: 2, impact: 2, score: 4, level: "Medio", note: "Evaluación inicial",
    createdBy: { id: 3, name: "Gerente" }
  }));
  const control = controlRepository.create({ title: "Control vinculado para detalle", description: "Descripción del control",
    type: "PREVENTIVE", frequency: "Monthly", ownerId: 3, ownerName: "Gerente", riskIds: [linked[0].id],
    effectiveness: 4, note: "Evaluación", createdBy: { id: 3, name: "Gerente" } });
  const evidence = evidenceRepository.create({ title: "Evidencia de auditoría", description: "Documento de apoyo",
    evidenceType: "DOCUMENT", entityType: "AUDIT", entityId: "AUD-02", author: { id: 3, name: "Gerente" } });
  const manager = await conversation(base, 3);
  const summary = await ask(manager, 3, "Detalles de la auditoría AUD-02");
  assert.equal(summary.mode, "action-guidance");
  assert.match(summary.text, /Auditoría AUD-02/);
  assert.match(summary.text, new RegExp(linked[3].id));
  assert.equal(summary.coverage.partial, true);
  assert.ok(summary.references.some((item) => item.id === control.id));
  assert.ok(summary.references.some((item) => item.id === evidence.id));
  const more = await ask(manager, 3, "Más riesgos de la auditoría AUD-02");
  assert.match(more.text, new RegExp(linked[0].id));
  assert.ok(more.references.some((item) => item.id === linked[0].id));
  assert.match((await ask(manager, 3, "Más riesgos de la auditoría AUD-02")).text, /No hay más riesgos/);
  const auditor = await conversation(base, 5);
  assert.match((await ask(auditor, 5, "Detalles de la auditoría AUD-02")).text, /no está disponible/);
  const ephemeral = await fetch(`${base}/api/assistant/ask`, options(3,
    { question: "Detalles de la auditoría AUD-02" }));
  assert.equal((await ephemeral.json()).mode, "action-guidance");
});
