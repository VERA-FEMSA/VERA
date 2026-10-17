const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("../evaluations/ai-regression-v1.json");
const { validateFixture, runSuite, markdown } = require("../scripts/evaluate-assistant-offline");

test("IA offline: cada caso tiene control positivo y negativo", () => {
  assert.doesNotThrow(() => validateFixture(fixture));
  const incomplete = { ...fixture, scenarios: fixture.scenarios.filter((row) => row.id !== "dato-y-fuente/acepta") };
  assert.throws(() => validateFixture(incomplete), /Faltan ejemplos positivos\/negativos/);
  const duplicate = { ...fixture, scenarios: [...fixture.scenarios, fixture.scenarios[0]] };
  assert.throws(() => validateFixture(duplicate), /ID duplicado/);
});

test("IA offline: el adaptador y los detectores reconocen todos los casos sintéticos", async () => {
  const report = await runSuite(fixture);
  assert.equal(report.total, fixture.scenarios.length);
  assert.equal(report.passed, report.total);
  assert.equal(report.failed, 0);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.externalCalls, 0);
  assert.ok(report.scenarios.some((row) => row.id === "fuente-ajena/filtrada" && row.observed === "reject"));
  assert.ok(report.scenarios.some((row) => row.id === "proveedor/cuota" && row.observed === "error:429"));
});

test("IA offline: una expectativa errónea produce fallo sin incluir respuestas en el reporte", async () => {
  const altered = { ...fixture, scenarios: fixture.scenarios.map((row) => row.id === "dato-y-fuente/rechaza-sin-fuente"
    ? { ...row, expected: "accept" } : row) };
  const report = await runSuite(altered);
  assert.equal(report.failed, 1);
  assert.equal(report.scenarios.find((row) => row.id === "dato-y-fuente/rechaza-sin-fuente").status, "FAIL");
  const serialized = JSON.stringify(report) + markdown(report);
  assert.ok(!serialized.includes("synthetic-evaluation-key"));
  assert.ok(!serialized.includes("PALABRA_PROHIBIDA"));
  assert.ok(!serialized.includes("CONFIDENCIAL_AJENO"));
  assert.ok(!serialized.includes("persona@example.invalid"));
  assert.ok(!serialized.includes("Nivel alto, puntuación 6."));
});
