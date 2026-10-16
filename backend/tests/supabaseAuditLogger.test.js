const test = require("node:test");
const assert = require("node:assert/strict");

const logger = require("../services/supabaseAuditLogger");

test("Supabase audit logger writes semantic events and filters the append-only ledger", async (context) => {
  const previous = {
    fetch: global.fetch, url: process.env.SUPABASE_URL,
    secret: process.env.SUPABASE_SECRET_KEY,
    legacy: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  context.after(() => {
    global.fetch = previous.fetch;
    for (const [name, value] of [
      ["SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.secret],
      ["SUPABASE_SERVICE_ROLE_KEY", previous.legacy]
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const rows = [];
  global.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/rest/v1/vera_audit_events");
    assert.equal(options.headers.apikey, "sb_secret_test");
    assert.equal(options.headers.Authorization, undefined);
    if (options.method === "POST") {
      const row = JSON.parse(options.body);
      rows.push(row);
      return new Response(null, { status: 201 });
    }
    assert.equal(options.method, "GET");
    let found = rows.filter((row) =>
      (!url.searchParams.has("action") || row.action === url.searchParams.get("action")?.slice(3)) &&
      (!url.searchParams.has("entity_id") || row.entity_id === url.searchParams.get("entity_id")?.slice(3)));
    const actor = url.searchParams.get("actor_username")?.slice(7, -1);
    if (actor) found = found.filter((row) => row.actor_username?.includes(actor));
    return Response.json(found.map((row) => ({ ...row, occurred_at: row.occurred_at })));
  };

  const recorded = await logger.logActivity({
    actor: { id: 1000, username: "gerente", role: "GERENTE" },
    action: "RISK_REGISTERED", details: { riskId: "RSK-1" }
  });
  assert.match(recorded.id, /^[0-9a-f-]{36}$/);
  assert.equal(rows[0].source, "APPLICATION");
  assert.equal(rows[0].entity_id, "RSK-1");
  await logger.logAccessChange({
    actor: { id: 1000, username: "gerente", role: "GERENTE" },
    action: "ROLE_CHANGED", target: { id: 1001, username: "auditor" }
  });

  const found = await logger.query({ action: "RISK_REGISTERED", actor: "GERENTE", entityId: "RSK-1", limit: 1 });
  assert.equal(found.length, 1);
  assert.equal(found[0].actor.id, 1000);
  assert.equal(found[0].details.riskId, "RSK-1");
  assert.ok(Number.isFinite(Date.parse(found[0].date)));
});

test("a semantic audit write failure is reported without reversing the business result", async (context) => {
  const previous = {
    fetch: global.fetch, error: console.error,
    url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY
  };
  context.after(() => {
    global.fetch = previous.fetch;
    console.error = previous.error;
    for (const [name, value] of [["SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.secret]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  global.fetch = async () => Response.json({ message: "unavailable" }, { status: 503 });
  const errors = [];
  console.error = (...args) => errors.push(args);
  const result = await logger.logActivity({
    actor: { id: 1000, username: "gerente" }, action: "RISK_UPDATED"
  });
  assert.equal(result, null);
  assert.equal(errors[0][0], "[AUDIT_EVENT_WRITE_FAILED]");
  await assert.rejects(logger.query(), (error) => error.auditStorage && error.status === 503);
});
