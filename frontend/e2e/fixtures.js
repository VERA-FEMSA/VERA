export const dashboardSummary = (role = "DIRECTOR") => {
  const auditor = role === "AUDITOR";
  return {
    role,
    title: ({ SUPER_ADMIN: "Control ejecutivo del portafolio", DIRECTOR: "Consulta del portafolio",
      GERENTE: "Seguimiento de planeación", AUDITOR: "Mis auditorías asignadas",
      JEFATURA: "Seguimiento del portafolio" })[role],
    description: "Resumen actualizado del portafolio y sus prioridades.",
    scopeLabel: auditor ? "Solo mis asignaciones" : "Portafolio completo",
    metrics: { total: auditor ? 1 : 4, pending: auditor ? 0 : 2, active: 1, highRisk: auditor ? 1 : 2, openFindings: 1, averageProgress: 70 },
    statusCounts: [
      { status: "OPEN", count: auditor ? 0 : 2 },
      { status: "APPROVED", count: 1 },
      { status: "ACTIVE", count: 1 },
      { status: "CLOSED", count: 0 },
      { status: "REJECTED", count: 0 }
    ],
    riskMatrix: [1, 2, 3].map((likelihood) => [1, 2, 3].map((impact) => ({
      likelihood,
      impact,
      risk: likelihood * impact <= 2 ? "Bajo" : likelihood * impact <= 4 ? "Medio" : "Alto",
      count: likelihood === 3 && impact === 2 ? 1 : 0
    }))),
    pendingItems: [{ id: "AUD-TEST", title: "Auditoría de prueba", area: "Operaciones", status: auditor ? "ACTIVE" : "OPEN", risk: "Alto", quarter: "Q2", year: 2026, progress: 20 }],
    permissions: { canCreate: ["SUPER_ADMIN", "GERENTE", "JEFATURA"].includes(role),
      canApprove: ["SUPER_ADMIN", "GERENTE"].includes(role),
      canManageExecution: ["SUPER_ADMIN", "GERENTE"].includes(role) }
  };
};

export const useSession = async (page, role = "DIRECTOR", id = 2) => {
  await page.addInitScript(({ sessionRole, sessionId }) => {
    localStorage.setItem("token", "e2e-fixture-token");
    localStorage.setItem("user", JSON.stringify({ id: sessionId, username: "qa", name: "Cuenta de prueba", role: sessionRole }));
  }, { sessionRole: role, sessionId: id });
};

export const stubDashboard = async (page, role = "DIRECTOR") => {
  await page.route("**/api/dashboard", (route) => route.fulfill({ json: dashboardSummary(role) }));
  await page.route("**/api/actions", (route) => route.fulfill({ json: { actions: [] } }));
};
