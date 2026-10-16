const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-dossier-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { buildAuditDossier } = require("../services/assistantDossierService");
const planningRepository = require("../repositories/planningRepository");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const findingRepository = require("../repositories/findingRepository");

const auth = (id) => ({ Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` });

test("Briefing: cuenta relaciones visibles, limita la muestra y exige fuente para la sugerencia", async () => {
  const audit = planningRepository.create({ title: `Expediente briefing ${Date.now()}`, objective: "Revisar controles.",
    area: "Operaciones", year: 2026, responsibleId: 5, createdBy: { id: 2 } });
  const own = riskRepository.create({ title: "Riesgo propio del briefing", linkedAuditId: audit.id,
    ownerId: 5, level: "Alto", score: 6, likelihood: 3, impact: 2, createdBy: { id: 2 } });
  const foreign = riskRepository.create({ title: "Riesgo ajeno confidencial del briefing", linkedAuditId: audit.id,
    ownerId: 4, level: "Medio", score: 4, likelihood: 2, impact: 2, createdBy: { id: 2 } });
  const control = controlRepository.create({ title: "Control del briefing", riskIds: [own.id, foreign.id],
    effectiveness: 2, createdBy: { id: 2 } });
  findingRepository.create({ title: "Hallazgo visible del briefing", riskId: own.id,
    controlId: control.id, createdBy: { id: 2 } });
  findingRepository.create({ title: "Hallazgo ajeno confidencial del briefing", riskId: foreign.id,
    controlId: control.id, createdBy: { id: 2 } });
  const result = await buildAuditDossier({ id: 5, role: "AUDITOR" }, audit.id, { ask: async ({ context }) => {
    const sent = JSON.stringify(context);
    assert.ok(sent.includes(own.id));
    assert.ok(!sent.includes(foreign.id));
    assert.ok(!sent.includes("Hallazgo ajeno confidencial"));
    return { answer: "Borrador: revisar el control asociado.", sourceIds: [`controls:${control.id}`],
      usage: { prompt_tokens: 70, completion_tokens: 12 } };
  } });
  assert.equal(result.sections.find((item) => item.key === "risks").total, 1);
  assert.equal(result.sections.find((item) => item.key === "controls").total, 1);
  assert.equal(result.sections.find((item) => item.key === "findings").total, 1);
  assert.equal(result.suggestionStatus, "generated");
  assert.equal(result.suggestion.citations[0].sourceId, `controls:${control.id}`);
  assert.deepEqual(result.usage, { promptTokens: 70, completionTokens: 12 });
  assert.ok(Number.isFinite(Date.parse(result.asOf)));
  assert.ok(!JSON.stringify(result).includes("ajeno confidencial"));

  const uncited = await buildAuditDossier({ id: 5, role: "AUDITOR" }, audit.id, {
    ask: async () => ({ answer: "Borrador sin fuente.", sourceIds: ["risks:OTHER"] })
  });
  assert.equal(uncited.suggestion, null);
  assert.equal(uncited.suggestionStatus, "uncited");
  const failed = await buildAuditDossier({ id: 5, role: "AUDITOR" }, audit.id, {
    ask: async () => { throw new Error("proveedor no disponible"); }
  });
  assert.equal(failed.suggestionStatus, "unavailable");
  assert.equal(failed.sections[0].total, 1);

  for (let index = 0; index < 11; index += 1) {
    riskRepository.create({ title: `Riesgo adicional del briefing ${index}`, linkedAuditId: audit.id,
      ownerId: 5, level: "Medio", score: 4, likelihood: 2, impact: 2, createdBy: { id: 2 } });
  }
  const many = await buildAuditDossier({ id: 5, role: "AUDITOR" }, audit.id, { generate: false });
  assert.equal(many.sections.find((item) => item.key === "risks").total, 12);
  assert.equal(many.sections.find((item) => item.key === "risks").shown, 10);
  assert.equal(many.sections.find((item) => item.key === "risks").items.length, 10);
});

test("Briefing: la ruta exige sesión y oculta auditorías fuera del alcance", async (t) => {
  const base = await startTestServer(t, app);
  const previous = process.env.VERA_AI_ENABLED;
  process.env.VERA_AI_ENABLED = "false";
  try {
    assert.equal((await fetch(`${base}/api/assistant/dossier/AUD-01`, { method: "POST" })).status, 401);
    const denied = await fetch(`${base}/api/assistant/dossier/AUD-01`, { method: "POST", headers: auth(5) });
    assert.equal(denied.status, 404);
    assert.ok(!(await denied.text()).includes("controles de acceso"));
    const allowed = await fetch(`${base}/api/assistant/dossier/AUD-01`, { method: "POST", headers: auth(2) });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    const data = await allowed.json();
    assert.equal(data.audit.sourceId, "audits:AUD-01");
    assert.equal(data.suggestion, null);
    assert.equal(data.suggestionStatus, "disabled");
    assert.equal(data.sections.length, 4);
  } finally {
    if (previous === undefined) delete process.env.VERA_AI_ENABLED;
    else process.env.VERA_AI_ENABLED = previous;
  }
});
