import { test, expect } from "@playwright/test";
import { useSession } from "./fixtures.js";

test("RF-29: report follows applied filters and exports a CSV", async ({ page }) => {
  await useSession(page, "DIRECTOR", 2);
  const audit = { id: "AUD-782", title: "Auditoría de operaciones", area: "Operaciones",
    status: "ACTIVE", year: 2026, quarter: "Q4", risk: "Alto", responsible: "Ana Auditor" };
  await page.route("**/api/planning/search**", (route) => route.fulfill({ json: { audits: [audit] } }));
  await page.route("**/api/planning/report**", (route) => {
    if (route.request().url().includes("format=csv")) return route.fulfill({
      status: 200, contentType: "text/csv; charset=utf-8",
      body: '\uFEFF"ID auditoría","Título"\r\n"AUD-782","Auditoría de operaciones"\r\n'
    });
    return route.fulfill({ json: {
      asOf: "2026-10-21T12:00:00.000Z", scope: "Portafolio visible para tu rol", total: 1,
      rows: [{ audit, risks: [{ id: "RSK-782", title: "Riesgo operativo" }],
        controls: [], findings: [], evidenceCount: 0 }]
    } });
  });
  await page.goto("/auditorias");
  await page.getByRole("textbox", { name: /Búsqueda por ID/ }).fill("Operaciones");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 resultado(s)" })).toBeVisible();
  await page.getByRole("button", { name: "Ver reporte" }).click();
  const report = page.getByRole("region", { name: "Reporte del portafolio" });
  await expect(report.getByText(/Riesgos: 1 · Controles: 0/)).toBeVisible();
  await expect(report.getByText(/RSK-782 · Riesgo operativo/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vera-reporte-portafolio.csv");
});
