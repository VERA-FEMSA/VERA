import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { useSession } from "./fixtures.js";

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
