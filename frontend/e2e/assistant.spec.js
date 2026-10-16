import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { useSession } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/assistant/brief", (route) => route.fulfill({ json: { role: "AUDITOR", signals: [] } }));
});

test("HU-34: consulta autorizada y navegación a registros relacionados", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: { available: true, mode: "read-only" } }));
  await page.route("**/api/assistant/ask", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.question).toContain("riesgos");
    await route.fulfill({ json: { answer: "Hay un riesgo alto en tu alcance.",
      references: [{ type: "Riesgo", id: "RSK-01", title: "Riesgo de acceso", path: "/riesgos" }] } });
  });
  await page.goto("/asistente");
  await expect(page.getByRole("heading", { name: "Asistente de auditoría" })).toBeVisible();
  await page.getByLabel("Tu pregunta").fill("¿Qué riesgos hay en mi alcance?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(page.getByText("Hay un riesgo alto en tu alcance.")).toBeVisible();
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
      { sourceId: "risks:RSK-1", type: "Riesgo", id: "RSK-1", title: "Riesgo de acceso", path: "/riesgos#risk-RSK-1" }
    ], references: [], durationMs: 1200 } });
  });
  await page.goto("/asistente?type=risk&id=RSK-1");
  await expect(page.getByText("Expediente en contexto")).toBeVisible();
  await page.getByLabel("Tu pregunta").fill("Resume este riesgo");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect(page.getByText("Registros citados")).toBeVisible();
  await page.getByLabel("Tu pregunta").fill("¿Y sus controles?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await expect.poll(() => calls).toBe(2);
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
