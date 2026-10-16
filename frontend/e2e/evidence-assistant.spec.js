import { test, expect } from "@playwright/test";
import { useSession } from "./fixtures.js";

test("Evidencias IA: consulta un TXT visible y muestra el fragmento citado en móvil", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  await page.setViewportSize({ width: 390, height: 844 });
  const evidence = { id: "EVD-42", title: "Informe de control", description: "Revisión mensual del acceso.",
    evidenceType: "REPORT", entityType: "RISK", entityId: "RSK-42", entityTitle: "Riesgo de acceso",
    author: { name: "Gerencia" }, createdAt: "2026-10-16T10:00:00.000Z",
    file: { mime: "text/plain", size: 120 } };
  await page.route("**/api/risks**", (route) => route.fulfill({ json: { risks: [] } }));
  await page.route("**/api/controls**", (route) => route.fulfill({ json: { controls: [] } }));
  await page.route("**/api/planning**", (route) => route.fulfill({ json: { proposals: [] } }));
  let asked = 0;
  await page.route("**/api/evidence/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/ask")) {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON().question).toContain("control");
      asked += 1;
      return route.fulfill({ json: { answer: "El control exige autorización previa.", mode: "generated",
        asOf: "2026-10-16T20:20:00.000Z", durationMs: 850,
        coverage: { indexedChunks: 2, includedChunks: 1, partial: true },
        citations: [{ sourceId: "evidence:EVD-42:chunk:0", evidenceId: "EVD-42", title: evidence.title,
          pageNumber: null, excerpt: "El control exige autorización previa para acceder al sistema.",
          path: "/evidencias#evidence-EVD-42" }] } });
    }
    return route.fulfill({ json: { evidence: [evidence] } });
  });
  await page.goto("/evidencias");
  await page.getByRole("button", { name: "Consultar contenido con IA" }).click();
  const dialog = page.getByRole("dialog", { name: "Preguntar sobre Informe de control" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Pregunta sobre el contenido").fill("¿Qué exige el control?");
  await dialog.getByRole("button", { name: "Consultar archivo" }).click();
  await expect(dialog.getByText("El control exige autorización previa.")).toBeVisible();
  await expect(dialog.getByText(/Se usaron 1 de 2 fragmentos/)).toBeVisible();
  await expect(dialog.getByText("El control exige autorización previa para acceder al sistema.")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Informe de control" })).toHaveAttribute("href", "/evidencias#evidence-EVD-42");
  expect(asked).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - visualViewport.width)).toBeLessThanOrEqual(1);
});
