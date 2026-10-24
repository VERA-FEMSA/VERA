const test = require("node:test");
const assert = require("node:assert/strict");
const { browseAssistant, parseBrowse, PAGE_SIZE } = require("../services/assistantBrowseService");
const riskRepository = require("../repositories/riskRepository");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET ||= "assistant-browse-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");

const auth = (id, body) => ({ method: "POST", headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  "Content-Type": "application/json"
}, body: JSON.stringify(body) });

test("El explorador entiende solicitudes explícitas y rechaza una continuación manipulada", () => {
  assert.deepEqual(parseBrowse("Muéstrame los riesgos altos"),
    { type: "risks", filter: "high", offset: 0 });
  assert.deepEqual(parseBrowse("¿Cuáles son las auditorías activas?"),
    { type: "audits", filter: "active", offset: 0 });
  assert.deepEqual(parseBrowse("Muéstrame controles asociados a riesgos"),
    { type: "controls", filter: null, offset: 0 });
  assert.equal(parseBrowse("¿Cuántos riesgos altos hay?"), null);
  assert.equal(parseBrowse("siguientes", { type: "risks", filter: "high", offset: 0, hasMore: true }).offset,
    PAGE_SIZE);
  assert.equal(parseBrowse("siguientes", { type: "risks", filter: "secret", offset: 0, hasMore: true }), null);
  assert.equal(parseBrowse("siguientes", { type: "risks", filter: "high", offset: "0", hasMore: true }), null);
});

test("El chat lista y pagina únicamente los riesgos visibles del auditor", async () => {
  const prefix = `Exploración ${Date.now()}-`;
  for (let index = 0; index < PAGE_SIZE + 1; index += 1) {
    riskRepository.create({ title: `${prefix}${index}`, ownerId: 5, level: "Alto", score: 6,
      likelihood: 3, impact: 2, createdBy: { id: 3 } });
  }
  const privateRisk = riskRepository.create({ title: "Riesgo ajeno para exploración", ownerId: 4,
    level: "Alto", score: 6, likelihood: 3, impact: 2, createdBy: { id: 3 } });
  const user = { id: 5, role: "AUDITOR" };
  const first = await browseAssistant(user, "Muéstrame todos los riesgos altos");
  assert.equal(first.mode, "browse");
  assert.equal(first.browse.items.length, PAGE_SIZE);
  assert.equal(first.browse.hasMore, true);
  assert.ok(first.browse.total >= PAGE_SIZE + 1);
  assert.ok(first.browse.items.every((item) => item.id !== privateRisk.id));
  const second = await browseAssistant(user, "siguientes", null, first.browse);
  assert.equal(second.browse.offset, PAGE_SIZE);
  assert.ok(second.browse.items.some((item) => item.title.startsWith(prefix)));
  assert.ok(second.browse.items.every((item) => item.id !== privateRisk.id));
  assert.equal(second.usage, null);
});

test("La conversación persiste la página y vuelve a autorizar la siguiente", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous;
  });
  const base = await startTestServer(t, app);
  const created = await fetch(`${base}/api/assistant/conversations`, auth(5, { focus: null }));
  assert.equal(created.status, 201);
  const { conversation } = await created.json();
  const first = await fetch(`${base}/api/assistant/conversations/${conversation.id}/ask`,
    auth(5, { question: "Muéstrame los riesgos altos" }));
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.message.mode, "browse");
  assert.ok(firstBody.message.browse.items.length > 0);
  const next = await fetch(`${base}/api/assistant/conversations/${conversation.id}/ask`,
    auth(5, { question: "siguientes" }));
  assert.equal(next.status, 200);
  const nextBody = await next.json();
  assert.equal(nextBody.message.browse.offset, PAGE_SIZE);
  const foreign = await fetch(`${base}/api/assistant/conversations/${conversation.id}/ask`,
    auth(4, { question: "siguientes" }));
  assert.equal(foreign.status, 404);
});
