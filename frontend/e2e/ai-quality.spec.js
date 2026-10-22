import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { useSession, stubDashboard } from "./fixtures.js";

test("Calidad IA: Super Admin ve agregados sin contenido de conversación", async ({ page }) => {
  await useSession(page, "SUPER_ADMIN", 1);
  let reads = 0;
  await page.route("**/api/assistant/quality", (route) => {
    reads += 1;
    return route.fulfill({ json: { windowDays: 30, asOf: "2026-10-22T12:00:00.000Z",
      total: 12, helpful: 9, unhelpful: 3, helpfulPercent: 75, partial: false,
      byMode: { generated: { helpful: 6, unhelpful: 2 }, computed: { helpful: 3, unhelpful: 1 } } } });
  });
  await page.goto("/calidad-ia");
  await expect(page.getByRole("heading", { name: "Calidad observada del asistente" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Módulos principales" })
    .getByRole("button", { name: "Calidad de IA" })).toHaveAttribute("aria-current", "page");
  const metrics = page.getByLabel("Indicadores de valoraciones");
  await expect(metrics.getByText("12", { exact: true })).toBeVisible();
  await expect(metrics.getByText("75 %", { exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Respuesta generada 6 2/ })).toBeVisible();
  await expect(page.getByText(/solo a quienes eligieron valorar/)).toBeVisible();
  await expect(page.getByText("Texto privado de una pregunta")).toHaveCount(0);
  const initialReads = reads;
  await page.getByRole("button", { name: "Actualizar datos" }).click();
  await expect.poll(() => reads).toBeGreaterThan(initialReads);
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});

test("Calidad IA: muestra estado vacío y cobertura parcial", async ({ page }) => {
  await useSession(page, "SUPER_ADMIN", 1);
  await page.route("**/api/assistant/quality", (route) => route.fulfill({ json: {
    windowDays: 30, asOf: "2026-10-22T12:00:00.000Z", total: 0, helpful: 0, unhelpful: 0,
    helpfulPercent: null, byMode: {}, partial: true
  } }));
  await page.goto("/calidad-ia");
  await expect(page.getByText("Aún no hay valoraciones en este periodo.")).toBeVisible();
  await expect(page.getByText(/muestra parcial/)).toBeVisible();
  await expect(page.getByLabel("Indicadores de valoraciones").getByText("—")).toBeVisible();
});

test("Calidad IA: Auditor no ve la opción ni abre la ruta administrativa", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await stubDashboard(page, "AUDITOR");
  await page.goto("/calidad-ia");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("navigation", { name: "Módulos principales" })
    .getByRole("button", { name: "Calidad de IA" })).toHaveCount(0);
});
