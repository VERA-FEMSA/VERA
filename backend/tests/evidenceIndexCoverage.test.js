const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "evidence-coverage-test-secret-32-chars";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const coverage = require("../repositories/evidenceIndexCoverage");
const evidenceRepository = require("../repositories/evidenceRepository");
const riskRepository = require("../repositories/riskRepository");

const auth = (id) => ({ Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` });

test("Cobertura persistible: estado conocido y archivo anterior desconocido se distinguen", async (t) => {
  const ownRisk = riskRepository.create({ title: "Riesgo con evidencia sintética", ownerId: 5,
    level: "Alto", score: 6, likelihood: 3, impact: 2, createdBy: { id: 3 } });
  const otherRisk = riskRepository.create({ title: "Riesgo privado sintético", ownerId: 4,
    level: "Medio", score: 4, likelihood: 2, impact: 2, createdBy: { id: 3 } });
  const create = (risk, title) => evidenceRepository.create({ title, description: "Informe sintético privado.",
    evidenceType: "REPORT", reference: "Archivo privado", entityType: "RISK", entityId: risk.id,
    entityTitle: risk.title, file: { mime: "text/plain", size: 12 },
    author: { id: 3, name: "Gerente", role: "GERENTE" } });
  const own = create(ownRisk, "Cobertura conocida");
  const old = create(ownRisk, "Archivo anterior");
  const foreign = create(otherRisk, "Cobertura ajena");
  t.after(() => { coverage.forget(own.id); coverage.forget(foreign.id); });
  await coverage.set(own.id, { status: "ready", chunks: 2, truncated: true });
  await coverage.set(foreign.id, { status: "ready", chunks: 1, truncated: false });
  const base = await startTestServer(t, app);
  const response = await fetch(`${base}/api/evidence`, { headers: auth(5) });
  assert.equal(response.status, 200);
  const items = (await response.json()).evidence;
  assert.equal(items.find((item) => item.id === own.id).contentIndex.truncated, true);
  assert.deepEqual(items.find((item) => item.id === old.id).contentIndex, { status: "unknown" });
  assert.equal(items.some((item) => item.id === foreign.id), false);
  const originalGetMany = coverage.getMany;
  try {
    coverage.getMany = async () => { throw new Error("Estado temporalmente no disponible"); };
    const degraded = await (await fetch(`${base}/api/evidence`, { headers: auth(5) })).json();
    assert.equal(degraded.indexCoverageUnavailable, true);
    assert.equal(degraded.evidence.find((item) => item.id === own.id).contentIndex.unavailable, true);
    assert.equal(degraded.evidence.some((item) => item.id === foreign.id), false);
  } finally { coverage.getMany = originalGetMany; }
  assert.equal((await fetch(`${base}/api/evidence`, { headers: auth(4) })).status, 200);
  await assert.rejects(coverage.set(own.id, { status: "ready", chunks: 61, truncated: false }),
    /estado de lectura/);
});

test("Supabase: cobertura privada usa lotes acotados y clave de servidor", async (t) => {
  const keys = ["VERA_EVIDENCE_COMMENT_STORE", "SUPABASE_URL", "SUPABASE_SECRET_KEY"];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { VERA_EVIDENCE_COMMENT_STORE: "supabase",
    SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_synthetic" });
  const originalFetch = global.fetch;
  const calls = [];
  t.after(() => { global.fetch = originalFetch; for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  global.fetch = async (input, options) => {
    calls.push({ url: new URL(input), options });
    if (options.method === "GET") return Response.json([]);
    return new Response(null, { status: 204 });
  };
  const ids = Array.from({ length: 51 }, (_, i) => `EVD-${String(i).padStart(4, "0")}`);
  assert.equal((await coverage.getMany(ids)).size, 0);
  await coverage.set(ids[0], { status: "pending", chunks: 0, truncated: false });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url.searchParams.get("limit"), "50");
  assert.equal(calls[1].url.searchParams.get("limit"), "1");
  assert.equal(calls.every((call) => call.options.headers.apikey === "sb_secret_synthetic"), true);
  assert.equal(calls.every((call) => !call.options.headers.Authorization), true);
  assert.equal(JSON.parse(calls[2].options.body).status, "pending");
  global.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(coverage.getMany([ids[0]]), /estado privado de lectura/);
});
