const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-conversations-test-secret-32-chars";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const riskRepository = require("../repositories/riskRepository");
const conversationRepository = require("../repositories/assistantConversationRepository");

const auth = (id, method = "GET", body) => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body === undefined ? {} : { "Content-Type": "application/json" })
}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test("Conversaciones IA: solo la cuenta propietaria puede abrir, continuar, renombrar o borrar", async (t) => {
  const previous = { enabled: process.env.VERA_AI_CONVERSATIONS_ENABLED,
    ai: process.env.VERA_AI_ENABLED, endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_API_KEY, deployment: process.env.AZURE_OPENAI_DEPLOYMENT };
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  process.env.VERA_AI_ENABLED = "true";
  process.env.AZURE_OPENAI_ENDPOINT = "https://vera-test.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-only-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "vera-chat";
  t.after(() => {
    for (const [name, value] of [["VERA_AI_CONVERSATIONS_ENABLED", previous.enabled],
      ["VERA_AI_ENABLED", previous.ai], ["AZURE_OPENAI_ENDPOINT", previous.endpoint],
      ["AZURE_OPENAI_API_KEY", previous.key], ["AZURE_OPENAI_DEPLOYMENT", previous.deployment]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const base = await startTestServer(t, app);
  const url = `${base}/api/assistant/conversations`;
  assert.equal((await fetch(url)).status, 401);
  const created = await fetch(url, auth(5, "POST", {}));
  assert.equal(created.status, 201);
  const thread = (await created.json()).conversation;
  assert.equal(thread.title, "Nueva conversación");
  assert.deepEqual(thread.messages, []);
  assert.equal(thread.scopeHash, undefined);
  assert.equal((await fetch(`${url}/${thread.id}`, auth(4))).status, 404);
  assert.equal((await fetch(`${url}/${thread.id}/ask`, auth(4, "POST", {
    question: "¿Cuántos riesgos altos tengo?" }))).status, 404);
  assert.equal((await fetch(`${url}/${thread.id}`, auth(5))).status, 200);
  const asked = await fetch(`${url}/${thread.id}/ask`, auth(5, "POST", {
    question: "¿Cuántos riesgos altos tengo?" }));
  assert.equal(asked.status, 200);
  const answer = await asked.json();
  assert.equal(answer.message.mode, "computed");
  assert.match(answer.message.text, /Riesgos altos/);
  const reopened = (await (await fetch(`${url}/${thread.id}`, auth(5))).json()).conversation;
  assert.equal(reopened.messages.length, 2);
  assert.equal(reopened.messages[0].text, "¿Cuántos riesgos altos tengo?");
  assert.equal(reopened.stale, false);
  assert.equal((await fetch(url, auth(5)).then((res) => res.json())).conversations[0].id, thread.id);
  const renamed = await fetch(`${url}/${thread.id}`, auth(5, "PATCH", {
    title: "Seguimiento personal", version: reopened.version }));
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).conversation.title, "Seguimiento personal");
  assert.equal((await fetch(`${url}/${thread.id}`, auth(5, "PATCH", {
    title: "Versión antigua", version: reopened.version }))).status, 409);
  assert.equal((await fetch(`${url}/${thread.id}`, auth(4, "DELETE"))).status, 404);
  assert.equal((await fetch(`${url}/${thread.id}`, auth(5, "DELETE"))).status, 204);
  assert.equal((await fetch(`${url}/${thread.id}`, auth(5))).status, 404);
});

test("Conversaciones IA: al cambiar el alcance no expone ni reutiliza respuestas anteriores", async (t) => {
  const previous = process.env.VERA_AI_CONVERSATIONS_ENABLED;
  process.env.VERA_AI_CONVERSATIONS_ENABLED = "true";
  t.after(() => { if (previous === undefined) delete process.env.VERA_AI_CONVERSATIONS_ENABLED;
    else process.env.VERA_AI_CONVERSATIONS_ENABLED = previous; });
  const base = await startTestServer(t, app);
  const url = `${base}/api/assistant/conversations`;
  const created = (await (await fetch(url, auth(5, "POST", {}))).json()).conversation;
  const risk = riskRepository.create({ title: "Cambio de alcance de prueba", ownerId: 5,
    level: "Medio", score: 4, likelihood: 2, impact: 2, createdBy: { id: 3 } });
  assert.ok(risk.id);
  const read = await fetch(`${url}/${created.id}`, auth(5));
  assert.equal(read.status, 200);
  assert.equal((await read.json()).conversation.stale, true);
  const ask = await fetch(`${url}/${created.id}/ask`, auth(5, "POST", {
    question: "¿Cuántos riesgos altos tengo?" }));
  assert.equal(ask.status, 409);
  const other = await fetch(`${url}/${created.id}`, auth(4));
  assert.equal(other.status, 404);
});

test("Conversaciones IA: Supabase filtra por cuenta y rol y exige versión al guardar", async (t) => {
  const previous = { mode: process.env.VERA_USER_STORE, url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY };
  const originalFetch = global.fetch;
  process.env.VERA_USER_STORE = "supabase";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
  t.after(() => {
    global.fetch = originalFetch;
    for (const [name, value] of [["VERA_USER_STORE", previous.mode], ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const id = "11111111-1111-4111-8111-111111111111";
  const row = { id, owner_id: 5, owner_role: "AUDITOR", title: "Nueva conversación",
    focus_type: null, focus_id: null, scope_hash: "a".repeat(64), messages: [], version: 1,
    created_at: "2026-10-22T18:00:00.000Z", updated_at: "2026-10-22T18:00:00.000Z" };
  global.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/rest/v1/vera_ai_conversations");
    assert.equal(url.searchParams.get("owner_id"), "eq.5");
    assert.equal(url.searchParams.get("owner_role"), "eq.AUDITOR");
    assert.equal(options.headers.apikey, "sb_secret_test_only");
    assert.equal(options.headers.Authorization, undefined);
    if (options.method === "PATCH") {
      assert.equal(url.searchParams.get("version"), "eq.1");
      assert.equal(JSON.parse(options.body).version, 2);
      return Response.json([{ ...row, title: "Seguimiento", version: 2 }]);
    }
    return Response.json([row]);
  };
  assert.equal((await conversationRepository.get({ id: 5, role: "AUDITOR" }, id)).title, "Nueva conversación");
  assert.equal((await conversationRepository.update({ id: 5, role: "AUDITOR" }, id, 1,
    { title: "Seguimiento" })).version, 2);
});
