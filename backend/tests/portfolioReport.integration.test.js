const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "portfolio-report-test-secret-over-32-characters";
const app = require("../server");
const { startTestServer } = require("./helpers/testServer");
const { reportToCsv } = require("../services/portfolioReportService");

const auth = (id, method = "GET", body) => ({
  method,
  headers: { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
    ...(body ? { "Content-Type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});

test("RF-29: report includes linked facts and filtered CSV with UTF-8 headings", async (context) => {
  const base = await startTestServer(context, app);
  const title = `Reporte regional ${Date.now()}`;
  const proposalResponse = await fetch(`${base}/api/planning`, auth(3, "POST", {
    title, objective: "Verificar la operación del proceso regional.", scope: "Operación regional.",
    justification: "Se requiere seguimiento de los controles.", area: "Operaciones",
    quarter: "Q4", year: 2026, responsibleId: 5
  }));
  assert.equal(proposalResponse.status, 201);
  const proposal = (await proposalResponse.json()).proposal;
  const riskResponse = await fetch(`${base}/api/risks`, auth(3, "POST", {
    title: `Riesgo de reporte ${Date.now()}`, description: "La falta de control puede generar incidencias.",
    area: "Operaciones", ownerId: 5, linkedAuditId: proposal.id, likelihood: 3, impact: 2,
    note: "Se detectó una exposición durante la revisión reciente."
  }));
  assert.equal(riskResponse.status, 201);
  const risk = (await riskResponse.json()).risk;
  const controlResponse = await fetch(`${base}/api/controls`, auth(3, "POST", {
    title: `Control regional ${Date.now()}`, description: "Revisión mensual por un responsable designado.",
    type: "DETECTIVE", frequency: "Monthly", ownerId: 3, riskIds: [risk.id], rating: 2,
    note: "La muestra presentó excepciones sin resolver."
  }));
  assert.equal(controlResponse.status, 201);
  const control = (await controlResponse.json()).control;
  const findingResponse = await fetch(`${base}/api/findings`, auth(3, "POST", {
    controlId: control.id, riskId: risk.id, title: "Excepción regional",
    description: "Se identificó una excepción durante la revisión."
  }));
  assert.equal(findingResponse.status, 201);

  const query = `q=${encodeURIComponent(proposal.id)}`;
  const response = await fetch(`${base}/api/planning/report?${query}`, auth(3));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const report = await response.json();
  assert.equal(report.total, 1);
  assert.equal(report.rows[0].audit.id, proposal.id);
  assert.deepEqual(report.rows[0].risks.map((item) => item.id), [risk.id]);
  assert.deepEqual(report.rows[0].controls.map((item) => item.id), [control.id]);
  assert.equal(report.rows[0].findings.length, 1);
  const assignedReport = await fetch(`${base}/api/planning/report?${query}`, auth(5));
  assert.equal(assignedReport.status, 200);
  assert.deepEqual((await assignedReport.json()).rows[0].risks.map((item) => item.id), [risk.id]);
  const csvResponse = await fetch(`${base}/api/planning/report?${query}&format=csv`, auth(3));
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get("content-type"), /text\/csv/);
  assert.match(csvResponse.headers.get("content-disposition"), /attachment/);
  const csvBytes = new Uint8Array(await csvResponse.arrayBuffer());
  assert.deepEqual([...csvBytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(csvBytes);
  for (const value of [proposal.id, risk.id, control.id, "Excepción regional"]) assert.ok(csv.includes(value));
});

test("RF-29: auditor sees only assigned records; empty and invalid filters are explicit", async (context) => {
  const base = await startTestServer(context, app);
  assert.equal((await fetch(`${base}/api/planning/report`)).status, 401);
  const manager = await fetch(`${base}/api/planning/report`, auth(3));
  const managerReport = await manager.json();
  assert.ok(managerReport.total > 0);
  const auditor = await fetch(`${base}/api/planning/report`, auth(5));
  assert.equal(auditor.status, 200);
  const auditorReport = await auditor.json();
  assert.ok(auditorReport.total <= managerReport.total);
  assert.ok(!auditorReport.rows.some((row) => row.audit.id === "AUD-01"));
  const auditorCsv = await (await fetch(`${base}/api/planning/report?format=csv`, auth(5))).text();
  assert.ok(!auditorCsv.includes("AUD-01"));
  const empty = await fetch(`${base}/api/planning/report?q=no-existe-ninguna-auditoria`, auth(3));
  assert.equal(empty.status, 200);
  assert.equal((await empty.json()).total, 0);
  const emptyCsv = await (await fetch(`${base}/api/planning/report?q=no-existe-ninguna-auditoria&format=csv`, auth(3))).text();
  assert.equal(emptyCsv.trim().split("\r\n").length, 1);
  for (const query of ["status=UNKNOWN", "q=x&q=y", "format=pdf"]) {
    assert.equal((await fetch(`${base}/api/planning/report?${query}`, auth(3))).status, 400);
  }
});

test("RF-29: CSV quotes values and neutralizes spreadsheet formulas", () => {
  const csv = reportToCsv({ rows: [{
    audit: { id: "AUD-X", title: '=HYPERLINK("https://invalid.example")', status: "OPEN",
      area: "Área, Norte", objective: "Línea 1\nLínea 2" },
    risks: [], controls: [], findings: [], evidenceCount: 0
  }] });
  assert.ok(csv.includes("'="));
  assert.ok(csv.includes('"Área, Norte"'));
  assert.ok(csv.includes('"Línea 1\nLínea 2"'));
  assert.ok(!csv.includes('"=HYPERLINK'));
});
