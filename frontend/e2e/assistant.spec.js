import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { useSession } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/assistant/brief", (route) => route.fulfill({ json: { role: "AUDITOR", signals: [] } }));
});

test("Copiloto: distingue un indicador calculado de una respuesta generada", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  await page.route("**/api/assistant/ask", (route) => route.fulfill({ json: {
    answer: "Riesgos altos en tu alcance: 3.", mode: "computed",
    metric: { key: "highRisks", label: "Riesgos altos", count: 3, path: "/riesgos" },
    citations: [], references: [], durationMs: 30
  } }));
  await page.goto("/asistente");
  await page.getByLabel("Tu pregunta").fill("¿Cuántos riesgos altos tengo?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(page.getByText("Riesgos altos en tu alcance: 3.")).toBeVisible();
  await expect(page.getByText(/Dato calculado desde registros autorizados/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Riesgos altos: 3/ })).toHaveAttribute("href", "/riesgos");
  await expect(page.getByText("Sin registros citados en esta respuesta.")).toHaveCount(0);
});

test("Copiloto: el conteo por área abre los mismos filtros exactos en riesgos", async ({ page }, testInfo) => {
  await useSession(page, "AUDITOR", 5);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  await page.route("**/api/assistant/ask", (route) => route.fulfill({ json: {
    answer: "Riesgos altos en el área Gestión Financiera: 2.", mode: "computed",
    metric: { key: "highRisksByArea", label: "Riesgos altos · Área: Gestión Financiera", count: 2,
      path: "/riesgos?level=Alto&area=Gesti%C3%B3n+Financiera", filter: { area: "Gestión Financiera" } },
    citations: [], references: []
  } }));
  await page.route("**/api/planning", (route) => route.fulfill({ json: { proposals: [] } }));
  let riskRequests = 0;
  await page.route("**/api/risks/**", (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("level")).toBe("Alto");
    expect(url.searchParams.get("area")).toBe("Gestión Financiera");
    riskRequests += 1;
    return route.fulfill({ json: { risks: [] } });
  });
  await page.goto("/asistente");
  await page.getByLabel("Tu pregunta").fill("¿Cuántos riesgos altos hay en el área Gestión Financiera?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(page.getByText("Riesgos altos en el área Gestión Financiera: 2.")).toBeVisible();
  await page.getByRole("link", { name: /Riesgos altos · Área: Gestión Financiera: 2/ }).click();
  await expect(page.getByLabel("Área exacta")).toHaveValue("Gestión Financiera");
  await expect(page.getByLabel("Nivel")).toHaveValue("Alto");
  await expect.poll(() => riskRequests).toBeGreaterThan(0);
  if (testInfo.project.name === "tablet-chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - visualViewport.width)).toBeLessThanOrEqual(1);
  }
});

test("HU-34: consulta autorizada y navegación a registros relacionados", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  await page.route("**/api/assistant/ask", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.question).toContain("riesgos");
    await route.fulfill({ json: { answer: "Hay un riesgo alto en tu alcance.", coverage: { partial: true },
      references: [{ type: "Riesgo", id: "RSK-01", title: "Riesgo de acceso", path: "/riesgos" }] } });
  });
  await page.goto("/asistente");
  await expect(page.getByRole("heading", { name: "Asistente de auditoría" })).toBeVisible();
  await page.getByLabel("Tu pregunta").fill("¿Qué riesgos hay en mi alcance?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(page.getByText("Hay un riesgo alto en tu alcance.")).toBeVisible();
  await expect(page.getByText(/muestra de expedientes visibles/)).toBeVisible();
  await page.getByText("Registros relacionados").click();
  await expect(page.getByRole("link", { name: /Riesgo: Riesgo de acceso/ })).toHaveAttribute("href", "/riesgos");
});

test("HU-34: sin configuración muestra indisponibilidad y deshabilita envío", async ({ page }) => {
  await useSession(page, "DIRECTOR", 2);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: false, mode: "read-only" } }));
  await page.goto("/asistente");
  await expect(page.getByText(/todavía no está habilitado/)).toBeVisible();
  await expect(page.getByLabel("Tu pregunta")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enviar pregunta" })).toBeDisabled();
});

test("HU-34: pantalla accesible y sin desbordamiento horizontal en móvil", async ({ page }) => {
  await useSession(page, "DIRECTOR", 2);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/asistente");
  await expect(page.getByLabel("Tu pregunta")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
});

test("Copiloto: conserva el contexto de expediente y la pregunta anterior en la sesión", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  let calls = 0;
  await page.route("**/api/assistant/ask", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.focus).toEqual({ type: "risk", id: "RSK-1" });
    if (calls === 0) expect(body.history).toEqual([]);
    else expect(body.history.some((item) => item.role === "user" && item.text === "Resume este riesgo")).toBe(true);
    calls += 1;
    await route.fulfill({ json: { answer: "Respuesta con contexto.", citations: [
      { sourceId: "risks:RSK-1", type: "Riesgo", id: "RSK-1", title: "Riesgo de acceso", path: "/riesgos#risk-RSK-1",
        facts: [{ label: "Nivel", value: "Alto" }, { label: "Puntaje", value: "6" }] }
    ], references: [], asOf: "2026-10-16T20:20:00.000Z", durationMs: 1200 } });
  });
  await page.goto("/asistente?type=risk&id=RSK-1");
  await expect(page.getByText("Expediente en contexto")).toBeVisible();
  await page.getByLabel("Tu pregunta").fill("Resume este riesgo");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(page.getByText("Registros citados")).toBeVisible();
  await expect(page.getByText("Nivel: Alto · Puntaje: 6")).toBeVisible();
  await expect(page.locator("time[datetime='2026-10-16T20:20:00.000Z']")).toBeVisible();
  await page.getByLabel("Tu pregunta").fill("¿Y sus controles?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect.poll(() => calls).toBe(2);
});

test("Copiloto: conserva la conversación al navegar y cerrar el panel", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  await page.route("**/api/dashboard", (route) => route.fulfill({ json: {
    role: "AUDITOR", scopeLabel: "Mis auditorías", title: "Panel de auditorías", permissions: { canCreate: false, canApprove: false },
    metrics: { total: 0, pending: 0, active: 0, highRisk: 0, openFindings: 0, averageProgress: 0 },
    statusCounts: [], riskMatrix: [], pendingItems: []
  } }));
  const requests = [];
  await page.route("**/api/assistant/ask", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({ json: { answer: `Respuesta ${requests.length}`, citations: [], references: [] } });
  });
  await page.goto("/asistente");
  await page.getByLabel("Tu pregunta").fill("Resume mis riesgos");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(page.getByText("Respuesta 1")).toBeVisible();
  const mobileMenu = page.getByRole("button", { name: "Abrir menú de navegación" });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.getByRole("button", { name: "Panel de Portafolio" }).click();
  await page.getByRole("button", { name: "Abrir asistente de IA" }).click();
  const dialog = page.getByRole("dialog", { name: "Copiloto VERA" });
  await expect(dialog.getByText("Respuesta 1")).toBeVisible();
  await dialog.getByLabel("Tu pregunta").fill("¿Y los controles relacionados?");
  await dialog.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(dialog.getByText("Respuesta 2")).toBeVisible();
  expect(requests[1].history).toEqual([
    { role: "user", text: "Resume mis riesgos" },
    { role: "assistant", text: "Respuesta 1" }
  ]);
  await dialog.getByRole("button", { name: "Cerrar asistente" }).click();
  await page.getByRole("button", { name: "Abrir asistente de IA" }).click();
  await expect(page.getByRole("dialog", { name: "Copiloto VERA" }).getByText("Respuesta 2")).toBeVisible();
  await page.getByRole("dialog", { name: "Copiloto VERA" }).getByRole("button", { name: "Cerrar asistente" }).click();
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.evaluate(() => {
    localStorage.setItem("token", "second-account-token");
    localStorage.setItem("user", JSON.stringify({ id: 4, role: "DIRECTOR", name: "Otra persona" }));
    history.pushState({}, "", "/dashboard");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.getByRole("button", { name: "Abrir asistente de IA" }).click();
  await expect(page.getByRole("dialog", { name: "Copiloto VERA" }).getByText("Respuesta 2")).toHaveCount(0);
});

test("Copiloto: abre un riesgo en panel contextual y lo envía como alcance", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await page.route("**/api/risks/**", (route) => route.fulfill({ json: { risks: [{
    id: "RSK-22", title: "Riesgo de acceso", description: "Accesos pendientes de revisión.",
    level: "Alto", score: 6, area: "Operaciones", ownerName: "Auditor", evaluations: [], responsePlan: ""
  }] } }));
  await page.route("**/api/planning", (route) => route.fulfill({ json: { proposals: [] } }));
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  await page.route("**/api/assistant/ask", (route) => {
    expect(route.request().postDataJSON().focus).toEqual({ type: "risk", id: "RSK-22" });
    return route.fulfill({ json: { answer: "Riesgo alto en revisión.", citations: [], references: [] } });
  });
  await page.goto("/riesgos");
  await page.getByRole("button", { name: "Analizar con IA" }).click();
  const dialog = page.getByRole("dialog", { name: "Copiloto VERA" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".assistant-focus span")).toHaveText("Riesgo de acceso");
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
  await dialog.getByLabel("Tu pregunta").fill("Resume este riesgo");
  await dialog.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(dialog.getByText("Riesgo alto en revisión.")).toBeVisible();
});

test("Copiloto: separa los hilos de dos riesgos", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await page.route("**/api/risks/**", (route) => route.fulfill({ json: { risks: [
    { id: "RSK-A", title: "Riesgo A", description: "Primer riesgo de prueba", level: "Alto", score: 6,
      area: "Operaciones", ownerName: "Auditor", evaluations: [], responsePlan: "" },
    { id: "RSK-B", title: "Riesgo B", description: "Segundo riesgo de prueba", level: "Medio", score: 4,
      area: "Operaciones", ownerName: "Auditor", evaluations: [], responsePlan: "" }
  ] } }));
  await page.route("**/api/planning", (route) => route.fulfill({ json: { proposals: [] } }));
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  const requests = [];
  await page.route("**/api/assistant/ask", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({ json: { answer: `Respuesta ${body.focus.id}`, citations: [], references: [] } });
  });
  await page.goto("/riesgos");
  const buttons = page.getByRole("button", { name: "Analizar con IA" });
  await expect(buttons).toHaveCount(2);
  await buttons.first().click();
  let dialog = page.getByRole("dialog", { name: "Copiloto VERA" });
  await dialog.getByLabel("Tu pregunta").fill("Analiza el primer riesgo");
  await dialog.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(dialog.getByText("Respuesta RSK-A")).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar asistente" }).click();
  await buttons.nth(1).click();
  dialog = page.getByRole("dialog", { name: "Copiloto VERA" });
  await expect(dialog.getByText("Respuesta RSK-A")).toHaveCount(0);
  await dialog.getByLabel("Tu pregunta").fill("Analiza el segundo riesgo");
  await dialog.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(dialog.getByText("Respuesta RSK-B")).toBeVisible();
  expect(requests[1].history).toEqual([]);
  await dialog.getByRole("button", { name: "Cerrar asistente" }).click();
  await buttons.first().click();
  await expect(page.getByRole("dialog", { name: "Copiloto VERA" }).getByText("Respuesta RSK-A")).toBeVisible();
});
