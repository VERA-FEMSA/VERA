const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "supabase-risk-control-test-secret-32-characters";
process.env.VERA_RISK_CONTROL_STORE = "supabase";
process.env.VERA_USER_STORE = "supabase";
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

test("HU-14/HU-15 use persistent risk and control sources across HTTP requests", async (context) => {
  const nativeFetch = global.fetch;
  const accounts = [
    { id: 1000, username: "gerente", email: "gerente@vera.local", name: "Gerente", role: "GERENTE", status: "ACTIVE", version: 1 },
    { id: 1001, username: "auditor", email: "auditor@vera.local", name: "Auditor", role: "AUDITOR", status: "ACTIVE", version: 1 }
  ];
  const tables = { vera_risks: new Map(), vera_controls: new Map() };
  global.fetch = async (input, options) => {
    if (!String(input).startsWith("https://supabase.example/")) return nativeFetch(input, options);
    const url = new URL(input);
    const table = url.pathname.split("/").at(-1);
    if (table === "vera_users") {
      const id = url.searchParams.get("id")?.slice(3);
      return Response.json(id ? accounts.filter((account) => account.id === Number(id)) : accounts);
    }
    assert.ok(tables[table]);
    const id = url.searchParams.get("id")?.slice(3);
    const version = Number(url.searchParams.get("version")?.slice(3));
    const found = id ? [tables[table].get(id)].filter(Boolean) : [...tables[table].values()];
    if (options.method === "GET") return Response.json(found);
    if (options.method === "POST") {
      const { id: newId, payload } = JSON.parse(options.body);
      const row = { payload, version: 1 };
      tables[table].set(newId, row);
      return Response.json([row], { status: 201 });
    }
    if (options.method === "PATCH") {
      if (!found.length || found[0].version !== version) return Response.json([]);
      const row = JSON.parse(options.body);
      tables[table].set(id, row);
      return Response.json([row]);
    }
    throw new Error(`Unexpected method ${options.method}`);
  };
  context.after(() => { global.fetch = nativeFetch; });

  const base = await startTestServer(context, app);
  const riskResponse = await fetch(`${base}/api/risks`, auth(1000, "POST", {
    title: "Riesgo persistente", area: "Finanzas", ownerId: 1001,
    description: "La conciliación tardía puede producir errores financieros.",
    likelihood: 2, impact: 3,
    note: "La revisión inicial identificó una brecha de control."
  }));
  assert.equal(riskResponse.status, 201);
  const risk = (await riskResponse.json()).risk;
  assert.match(risk.id, /^RSK-/);
  assert.equal(tables.vera_risks.size, 1);

  const controlResponse = await fetch(`${base}/api/controls`, auth(1000, "POST", {
    title: "Control persistente", area: "Finanzas", ownerId: 1000,
    description: "Otra persona revisa la conciliación cada mes.",
    type: "DETECTIVE", frequency: "Monthly", riskIds: [risk.id], rating: 4,
    note: "La prueba inicial mostró evidencia completa y suficiente."
  }));
  assert.equal(controlResponse.status, 201);
  const control = (await controlResponse.json()).control;
  assert.equal(tables.vera_controls.size, 1);
  assert.deepEqual(control.riskIds, [risk.id]);

  const auditorRisks = await fetch(`${base}/api/risks`, auth(1001));
  assert.ok((await auditorRisks.json()).risks.some((item) => item.id === risk.id));
  const auditorControls = await fetch(`${base}/api/controls`, auth(1001));
  assert.ok((await auditorControls.json()).controls.some((item) => item.id === control.id));

  const evidence = await fetch(`${base}/api/evidence`, auth(1001, "POST", {
    title: "Acta de revisión", description: "Acta que documenta la revisión del riesgo.",
    evidenceType: "DOCUMENT", reference: "https://example.test/acta.pdf",
    entityType: "RISK", entityId: risk.id
  }));
  assert.equal(evidence.status, 201);
  const assessment = await fetch(`${base}/api/controls/${control.id}/evaluate`, auth(1000, "POST", {
    rating: 2, note: "La evaluación posterior detectó excepciones abiertas."
  }));
  assert.equal(assessment.status, 200);
  assert.equal(tables.vera_controls.get(control.id).version, 2);
});
