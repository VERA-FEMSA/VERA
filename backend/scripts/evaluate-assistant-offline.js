// Suite determinista y sintética. Inyecta fetch: nunca contacta a Azure ni a Supabase.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { askAzureOpenAi } = require("../services/azureOpenAiService");
const { cases, context, assess } = require("./assistant-evaluation-cases");

const FIXTURE = path.resolve(__dirname, "../evaluations/ai-regression-v1.json");
const REPORT_DIR = path.resolve(__dirname, "../../quality-report");
const TEST_CONFIG = {
  VERA_AI_ENABLED: "true",
  AZURE_OPENAI_ENDPOINT: "https://vera-eval.openai.azure.com",
  AZURE_OPENAI_API_KEY: "synthetic-evaluation-key",
  AZURE_OPENAI_DEPLOYMENT: "vera-eval-synthetic"
};

const percentile = (values, fraction) => values.length
  ? Math.round([...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] * 100) / 100 : null;

function validateFixture(fixture) {
  assert.equal(fixture?.version, "ai-regression-v1");
  assert.ok(Array.isArray(fixture.scenarios) && fixture.scenarios.length > 0);
  const ids = new Set();
  const coverage = new Map(cases.map((item) => [item.id, new Set()]));
  for (const scenario of fixture.scenarios) {
    assert.match(scenario.id, /^[a-z0-9-]+\/[a-z0-9-]+$/);
    assert.ok(!ids.has(scenario.id), `ID duplicado: ${scenario.id}`);
    ids.add(scenario.id);
    assert.ok(coverage.has(scenario.caseId), `Caso desconocido: ${scenario.caseId}`);
    assert.ok(["accept", "reject", "error:429", "error:502"].includes(scenario.expected));
    if (scenario.expected === "accept" || scenario.expected === "reject") {
      assert.equal(typeof scenario.answer, "string");
      assert.ok(Array.isArray(scenario.sourceIds) && scenario.sourceIds.every((id) => typeof id === "string"));
      coverage.get(scenario.caseId).add(scenario.expected);
    }
    if (scenario.httpStatus !== undefined) assert.equal(scenario.httpStatus, 429);
    if (scenario.rawContent !== undefined) assert.equal(typeof scenario.rawContent, "string");
  }
  for (const [id, kinds] of coverage) {
    assert.ok(kinds.has("accept") && kinds.has("reject"), `Faltan ejemplos positivos/negativos: ${id}`);
  }
}

function mockFetch(scenario) {
  return async (url, options) => {
    assert.equal(url, `${TEST_CONFIG.AZURE_OPENAI_ENDPOINT}/openai/v1/chat/completions`);
    assert.equal(options.method, "POST");
    assert.equal(options.headers["api-key"], TEST_CONFIG.AZURE_OPENAI_API_KEY);
    const request = JSON.parse(options.body);
    assert.equal(request.model, TEST_CONFIG.AZURE_OPENAI_DEPLOYMENT);
    assert.equal(request.response_format.type, "json_object");
    assert.equal(request.messages[0].role, "system");
    assert.equal(request.messages[1].role, "user");
    if (scenario.httpStatus) return { ok: false, status: scenario.httpStatus };
    const content = scenario.rawContent ?? JSON.stringify({ answer: scenario.answer, sourceIds: scenario.sourceIds });
    return { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content } }] }) };
  };
}

async function runSuite(fixture) {
  validateFixture(fixture);
  const previous = Object.fromEntries(Object.keys(TEST_CONFIG).map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const rows = [];
  try {
    Object.assign(process.env, TEST_CONFIG);
    globalThis.fetch = async () => { throw new Error("La evaluación offline bloquea llamadas de red."); };
    for (const scenario of fixture.scenarios) {
      const item = cases.find((candidate) => candidate.id === scenario.caseId);
      const start = performance.now();
      let observed;
      let checks = {};
      try {
        const result = await askAzureOpenAi({ question: item.question, context: item.context || context,
          history: item.history || [], fetchImpl: mockFetch(scenario) });
        const assessment = assess(item, result);
        observed = assessment.passed ? "accept" : "reject";
        checks = assessment.checks;
      } catch (error) {
        observed = Number.isInteger(error.status) ? `error:${error.status}` : "error:unexpected";
      }
      rows.push({ id: scenario.id, caseId: scenario.caseId, expected: scenario.expected, observed,
        status: observed === scenario.expected ? "PASS" : "FAIL", checks,
        durationMs: Math.round((performance.now() - start) * 100) / 100 });
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const durations = rows.map((row) => row.durationMs);
  return { suite: fixture.version, executedAtUtc: new Date().toISOString(), commit: process.env.GITHUB_SHA || null,
    mode: "offline-synthetic", modelCalls: 0, externalCalls: 0, total: rows.length,
    passed: rows.filter((row) => row.status === "PASS").length,
    failed: rows.filter((row) => row.status === "FAIL").length,
    harnessP50Ms: percentile(durations, 0.5), harnessP95Ms: percentile(durations, 0.95),
    scenarios: rows };
}

function markdown(report) {
  const lines = ["# Evaluación continua de IA", "", `- Suite: \`${report.suite}\``,
    `- Modo: sintético y sin red; llamadas al modelo: **${report.modelCalls}**`,
    `- Commit: \`${report.commit || "local"}\``, `- Ejecutado (UTC): ${report.executedAtUtc}`,
    `- Resultado: **${report.passed}/${report.total}**; fallos: **${report.failed}**`,
    `- Tiempo p50/p95 del arnés: ${report.harnessP50Ms}/${report.harnessP95Ms} ms (no es latencia de Azure)`,
    "", "| Escenario | Esperado | Observado | Resultado | ms |", "| --- | --- | --- | --- | ---: |"];
  for (const row of report.scenarios) {
    lines.push(`| ${row.id} | ${row.expected} | ${row.observed} | ${row.status} | ${row.durationMs} |`);
  }
  lines.push("", "La suite comprueba el contrato del adaptador y que los detectores distingan respuestas válidas de regresiones sintéticas. No evalúa la calidad de un modelo real ni datos de producción.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const report = await runSuite(fixture);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "ai-evaluation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const summary = markdown(report);
  fs.writeFileSync(path.join(REPORT_DIR, "ai-evaluation.md"), summary, "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  for (const row of report.scenarios) console.log(`${row.status} ${row.id} (${row.durationMs} ms)`);
  console.log(`IA offline: ${report.passed}/${report.total}; fallos=${report.failed}; p50/p95 del arnés=${report.harnessP50Ms}/${report.harnessP95Ms} ms`);
  if (report.failed) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => {
  console.error(`Evaluación inválida: ${error.message}`);
  process.exitCode = 2;
});

module.exports = { validateFixture, runSuite, markdown };
