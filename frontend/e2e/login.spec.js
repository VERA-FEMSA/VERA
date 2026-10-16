import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dashboardSummary } from "./fixtures.js";

test("login submits credentials and opens the role dashboard", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ username: "demo@vera.local", password: "vera123" });
    await route.fulfill({ json: { token: "e2e-session-token", user: { id: 2, username: "demo", name: "Usuario Demo", role: "DIRECTOR" } } });
  });
  await page.route("**/api/dashboard", (route) => route.fulfill({ json: dashboardSummary("DIRECTOR") }));

  await page.goto("/");
  await page.locator('input[autocomplete="username"]').fill("demo@vera.local");
  await page.locator('input[type="password"]').fill("vera123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Decisiones del portafolio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nueva propuesta" })).toBeVisible();
});

test("login explains invalid credentials without showing technical details", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.fulfill({
    status: 401,
    json: { message: "Usuario o contraseña incorrectos" }
  }));
  await page.goto("/");
  await page.locator('input[autocomplete="username"]').fill("missing@vera.local");
  await page.locator('input[type="password"]').fill("incorrecta");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByText("Usuario o contraseña incorrectos")).toBeVisible();
  await expect(page.getByText(/stack|exception|trace/i)).toHaveCount(0);
});

test("login page has no automated WCAG 2.1 A/AA violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
});

test("login remains within mobile and tablet viewport widths", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows, `horizontal overflow at ${viewport.width}px`).toBe(false);
  }
});

test("registration link opens the account request page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Correo institucional" })).toHaveAttribute("placeholder", "correo@institucion.mx");
  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByRole("textbox", { name: "Correo institucional" })).toHaveAttribute("placeholder", "correo@institucion.mx");
  await expect(page.getByRole("button", { name: "Enviar solicitud" })).toBeVisible();
});
