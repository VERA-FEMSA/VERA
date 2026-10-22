const test = require("node:test");
const assert = require("node:assert/strict");
const findings = require("../repositories/supabaseFindingRepository");

test("Supabase HU-15 guarda relación control/riesgo y usa credencial solo de servidor", async (context) => {
  const before = { fetch: global.fetch, url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY };
  context.after(() => {
    global.fetch = before.fetch;
    if (before.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = before.url;
    if (before.secret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = before.secret;
  });
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  const rows = [];
  global.fetch = async (input, options) => {
    assert.equal(new URL(input).pathname, "/rest/v1/vera_findings");
    assert.equal(options.headers.apikey, "sb_secret_test");
    assert.equal(options.headers.Authorization, undefined);
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal(body.control_id, "CTL-123");
      assert.equal(body.risk_id, "RSK-123");
      const row = { payload: body.payload, version: 1 };
      rows.push(row);
      return Response.json([row], { status: 201 });
    }
    if (options.method === "PATCH") {
      const body = JSON.parse(options.body);
      assert.equal(body.payload.status, "CLOSED");
      assert.equal(body.version, 2);
      const row = { payload: body.payload, version: body.version };
      rows[0] = row;
      return Response.json([row]);
    }
    return Response.json(rows);
  };
  const created = await findings.create({
    title: "Excepción", description: "La revisión documentó excepciones.",
    controlId: "CTL-123", riskId: "RSK-123", evaluationVersion: 2,
    createdBy: { id: 5, username: "auditor", role: "AUDITOR" }
  });
  assert.match(created.id, /^FDG-[0-9a-f-]{36}$/);
  assert.equal(created.status, "OPEN");
  assert.equal((await findings.getAll())[0].evaluationVersion, 2);
  const closed = await findings.mutate(created.id, {
    status: "CLOSED", closureNote: "Se completó el plan de acción.", closedAt: new Date().toISOString()
  }, created.storageVersion);
  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.storageVersion, 2);
  assert.equal((await findings.findById(created.id)).closureNote, "Se completó el plan de acción.");
});
