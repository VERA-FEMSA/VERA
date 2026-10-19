import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { stubDashboard, useSession } from "./fixtures.js";

test("director sees dashboard metrics and charts without decision actions", async ({ page }) => {
  await useSession(page, "DIRECTOR", 2);
  await stubDashboard(page, "DIRECTOR");
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Consulta del portafolio" })).toBeVisible();
  await expect(page.getByText("REGISTROS VISIBLES", { exact: true })).toBeVisible();
  await expect(page.getByText("HALLAZGOS ABIERTOS", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Registros por estado" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Matriz probabilidad × impacto" })).toBeVisible();
  await expect(page.locator(".dashboard-risk-cell")).toHaveCount(9);
  await expect(page.getByRole("navigation", { name: "Acciones rápidas" }).getByRole("link", { name: "Nueva propuesta" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Acciones rápidas" }).getByRole("link", { name: "Revisar propuestas" })).toHaveCount(0);
});

test("manager has proposal and review actions", async ({ page }) => {
  await useSession(page, "GERENTE", 3);
  await stubDashboard(page, "GERENTE");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Seguimiento de planeación" })).toBeVisible();
  const actions = page.getByRole("navigation", { name: "Acciones rápidas" });
  await expect(actions.getByRole("link", { name: "Nueva propuesta" })).toBeVisible();
  await expect(actions.getByRole("link", { name: "Revisar propuestas" })).toBeVisible();
});

test("auditor sees assigned work without director actions", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await stubDashboard(page, "AUDITOR");
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Mis auditorías asignadas" })).toBeVisible();
  const actions = page.getByRole("navigation", { name: "Acciones rápidas" });
  await expect(actions.getByRole("link", { name: "Nueva propuesta" })).toHaveCount(0);
  await expect(actions.getByRole("link", { name: "Revisar propuestas" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Mis auditorías por atender" })).toBeVisible();
});

test("dashboard has no horizontal overflow on mobile and tablet viewports", async ({ page }) => {
  await useSession(page, "DIRECTOR", 2);
  await stubDashboard(page, "DIRECTOR");

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Consulta del portafolio" })).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows, `horizontal overflow at ${viewport.width}px`).toBe(false);
  }
});

test("dashboard has no automated WCAG 2.1 A/AA violations", async ({ page }) => {
  await useSession(page, "DIRECTOR", 2);
  await stubDashboard(page, "DIRECTOR");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Consulta del portafolio" })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
});
