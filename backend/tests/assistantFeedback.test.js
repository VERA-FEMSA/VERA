const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "assistant-feedback-test-secret-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { issueFeedbackToken, verifyFeedbackToken } = require("../services/assistantFeedbackToken");
const feedback = require("../repositories/assistantFeedbackRepository");
const auth = (id, method = "GET", body) => ({ method, headers: {
  Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
  ...(body ? { "Content-Type": "application/json" } : {})
}, ...(body ? { body: JSON.stringify(body) } : {}) });

test("Feedback: token binds interaction, user, mode and expiry", () => {
  const token = issueFeedbackToken({ id: 5 }, "ask", "computed");
  const verified = verifyFeedbackToken(token, { id: 5 });
  assert.equal(verified.channel, "ask");
  assert.equal(verified.mode, "computed");
  assert.match(verified.interactionId, /^[0-9a-f-]{36}$/);
  assert.throws(() => verifyFeedbackToken(token, { id: 4 }), (error) => error.status === 400);
  assert.throws(() => verifyFeedbackToken(`${token}x`, { id: 5 }), (error) => error.status === 400);
  assert.throws(() => issueFeedbackToken({ id: 5 }, "other", "computed"));
});

test("Feedback: one rating per answer and admin sees only aggregate counts", async (context) => {
  const base = await startTestServer(context, app);
  const token = issueFeedbackToken({ id: 5 }, "ask", "computed");
  assert.equal((await fetch(`${base}/api/assistant/feedback`, { method: "POST" })).status, 401);
  assert.equal((await fetch(`${base}/api/assistant/feedback`, auth(4, "POST", {
    feedbackToken: token, rating: "helpful" }))).status, 400);
  assert.equal((await fetch(`${base}/api/assistant/feedback`, auth(5, "POST", {
    feedbackToken: token, rating: "maybe" }))).status, 400);
  const saved = await fetch(`${base}/api/assistant/feedback`, auth(5, "POST", {
    feedbackToken: token, rating: "helpful" }));
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).recorded, true);
  assert.equal((await fetch(`${base}/api/assistant/feedback`, auth(5, "POST", {
    feedbackToken: token, rating: "unhelpful" }))).status, 409);
  assert.equal((await fetch(`${base}/api/assistant/quality`, auth(5))).status, 403);
  const result = await fetch(`${base}/api/assistant/quality`, auth(1));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  const summary = await result.json();
  assert.ok(summary.helpful >= 1);
  assert.equal(summary.byMode.computed.helpful >= 1, true);
  assert.ok(!JSON.stringify(summary).includes("interaction_id"));
  assert.ok(!JSON.stringify(summary).includes("user_id"));
});

test("Feedback: Supabase write sends only metadata and reads a bounded window", async () => {
  const previous = { mode: process.env.VERA_USER_STORE, url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY, fetch: global.fetch };
  process.env.VERA_USER_STORE = "supabase";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return options.method === "GET" ? Response.json([{ rating: "unhelpful", response_mode: "generated",
      channel: "ask", created_at: "2026-10-17T00:00:00Z" }]) : new Response(null, { status: 201 });
  };
  try {
    await feedback.save({ interactionId: "f176f346-068e-4270-b74c-83e663290afe", channel: "ask",
      mode: "generated", rating: "unhelpful" });
    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(Object.keys(body).sort(), ["channel", "created_at", "interaction_id", "rating", "response_mode"]);
    const summary = await feedback.summary({ now: new Date("2026-10-17T12:00:00Z") });
    assert.equal(summary.unhelpful, 1);
    assert.equal(summary.helpfulPercent, 0);
    assert.match(calls[1].url, /created_at=gte\./);
  } finally {
    global.fetch = previous.fetch;
    for (const [name, value] of [["VERA_USER_STORE", previous.mode], ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("Feedback: fallos del almacén no convierten una valoración en éxito", async (t) => {
  const previous = { mode: process.env.VERA_USER_STORE, url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY, fetch: global.fetch };
  t.after(() => {
    global.fetch = previous.fetch;
    for (const [name, value] of [["VERA_USER_STORE", previous.mode], ["SUPABASE_URL", previous.url],
      ["SUPABASE_SECRET_KEY", previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  process.env.VERA_USER_STORE = "supabase";
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  const rating = { interactionId: "b0060eed-751e-4912-af92-c44d7d5355cf", channel: "ask",
    mode: "generated", rating: "helpful" };
  global.fetch = async () => new Response("error no JSON", { status: 500 });
  await assert.rejects(() => feedback.save(rating), (error) => error.status === 503);
  global.fetch = async () => Response.json({ code: "23505" }, { status: 409 });
  await assert.rejects(() => feedback.save(rating), (error) => error.status === 409);
  global.fetch = async () => Response.json({ malformed: true });
  await assert.rejects(() => feedback.summary(), (error) => error.status === 503);
});
