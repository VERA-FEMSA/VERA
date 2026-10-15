const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "supabase-planning-test-secret-32-characters";
process.env.VERA_PLANNING_STORE = "supabase";
process.env.SUPABASE_URL = "https://supabase.example";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test";

const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const token = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const auth = (id, method = "GET", body) => ({
  method,
  headers: { Authorization: `Bearer ${token(id)}`, ...(body ? { "Content-Type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});

test("HU-07/HU-09/HU-22/HU-23 use the Supabase planning source across API requests", async (context) => {
  const nativeFetch = global.fetch;
  const stored = new Map();
  global.fetch = async (input, options) => {
    if (!String(input).startsWith("https://supabase.example/")) return nativeFetch(input, options);
    const url = new URL(input);
    const id = url.searchParams.get("id")?.slice(3);
    const version = Number(url.searchParams.get("version")?.slice(3));
    const rows = id ? [stored.get(id)].filter(Boolean) : [...stored.values()];
    if (options.method === "GET") return Response.json(rows);
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      const row = { payload: body.payload, version: 1 };
      stored.set(body.id, row);
      return Response.json([row], { status: 201 });
    }
    if (!rows.length || rows[0].version !== version) return Response.json([]);
    if (options.method === "PATCH") {
      const row = JSON.parse(options.body);
      stored.set(id, row);
      return Response.json([row]);
    }
    throw new Error(`Unexpected method: ${options.method}`);
  };
  context.after(() => { global.fetch = nativeFetch; });

  const base = await startTestServer(context, app);
  const createdResponse = await fetch(`${base}/api/planning`, auth(3, "POST", {
    title: "Propuesta almacenada", objective: "Validar la revisión de procesos",
    scope: "Procesos operativos.", justification: "Se requiere una revisión formal.",
    area: "Operaciones", year: 2026, quarter: "Q2", responsibleId: 5, likelihood: 3, impact: 2
  }));
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).proposal;
  assert.equal(stored.size, 1);

  const review = await fetch(`${base}/api/notifications`, auth(2));
  assert.equal(review.status, 200);
  assert.ok((await review.json()).notifications.some((item) => item.entityId === created.id));

  const approval = await fetch(`${base}/api/planning/${created.id}/approve`, auth(2, "POST", { quarter: "Q2" }));
  assert.equal(approval.status, 200);
  const start = await fetch(`${base}/api/planning/${created.id}/start`, auth(2, "POST", {}));
  assert.equal(start.status, 200);

  const active = await fetch(`${base}/api/planning/active`, auth(5));
  assert.equal(active.status, 200);
  assert.equal((await active.json()).audits[0].id, created.id);
  const dashboard = await fetch(`${base}/api/dashboard`, auth(5));
  assert.equal(dashboard.status, 200);
  const summary = await dashboard.json();
  assert.equal(summary.metrics.active, 1);
  assert.equal(summary.riskMatrix.flat().reduce((sum, cell) => sum + cell.count, 0), 1);
  assert.equal(stored.get(created.id).payload.status, "ACTIVE");
});
