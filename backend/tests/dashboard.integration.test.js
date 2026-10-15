const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET ||= "dashboard-integration-test-secret-32-characters";

const app = require("../server");
const { startTestServer } = require("./helpers/testServer");

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const json = (token, method = "GET", body) => ({
  method,
  headers: {
    Authorization: `Bearer ${token}`,
    ...(body ? { "Content-Type": "application/json" } : {})
  },
  ...(body ? { body: JSON.stringify(body) } : {})
});

test("HU-07: dashboard data is authenticated and scoped according to the user's role", async (context) => {
  const baseUrl = await startTestServer(context, app);

  const anonymous = await fetch(`${baseUrl}/api/dashboard`);
  assert.equal(anonymous.status, 401);

  const proposalResponse = await fetch(`${baseUrl}/api/planning`, json(tokenFor(3), "POST", {
    title: `HU-07 assigned ${Date.now()}`,
    objective: "Validar la vista de carga por usuario.",
    scope: "Auditorías asignadas al equipo.",
    justification: "Se requiere seguimiento de la carga.",
    area: "Tecnología",
    responsibleId: 5,
    likelihood: 3,
    impact: 2,
    year: 2026,
    quarter: "Q2"
  }));
  assert.equal(proposalResponse.status, 201);
  const proposal = (await proposalResponse.json()).proposal;

  const activeResponse = await fetch(`${baseUrl}/api/planning/${proposal.id}/approve`, json(tokenFor(2), "POST", { quarter: "Q2" }));
  assert.equal(activeResponse.status, 200);
  const startedResponse = await fetch(`${baseUrl}/api/planning/${proposal.id}/start`, json(tokenFor(2), "POST", {}));
  assert.equal(startedResponse.status, 200);

  const auditorResponse = await fetch(`${baseUrl}/api/dashboard`, json(tokenFor(5)));
  assert.equal(auditorResponse.status, 200);
  const auditorDashboard = await auditorResponse.json();
  assert.equal(auditorDashboard.role, "AUDITOR");
  assert.equal(auditorDashboard.scopeLabel, "Solo mis asignaciones");
  assert.ok(auditorDashboard.pendingItems.some((item) => item.id === proposal.id));
  assert.equal(auditorDashboard.permissions.canCreate, false);
  assert.equal(auditorDashboard.permissions.canApprove, false);
  assert.equal(auditorDashboard.metrics.total, 1);
  assert.equal(auditorDashboard.metrics.active, 1);
  assert.equal(auditorDashboard.riskMatrix.flat().reduce((sum, cell) => sum + cell.count, 0), 1);

  const auditorPlanningResponse = await fetch(`${baseUrl}/api/planning`, json(tokenFor(5)));
  const auditorPlanning = await auditorPlanningResponse.json();
  assert.ok(auditorPlanning.proposals.every((item) => item.responsibleId === 5));
  const auditorActiveResponse = await fetch(`${baseUrl}/api/planning/active`, json(tokenFor(5)));
  const auditorActive = await auditorActiveResponse.json();
  assert.ok(auditorActive.audits.every((item) => item.responsibleId === 5));

  const directorResponse = await fetch(`${baseUrl}/api/dashboard`, json(tokenFor(2)));
  assert.equal(directorResponse.status, 200);
  const directorDashboard = await directorResponse.json();
  assert.equal(directorDashboard.scopeLabel, "Portafolio completo");
  assert.ok(directorDashboard.metrics.total > auditorDashboard.metrics.total);
  assert.equal(directorDashboard.permissions.canApprove, true);
  assert.ok(directorDashboard.statusCounts.some((entry) => entry.status === "OPEN" && entry.count > 0));
  assert.equal(directorDashboard.riskMatrix.flat().reduce((sum, cell) => sum + cell.count, 0), 1);
});
