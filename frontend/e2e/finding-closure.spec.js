import { test, expect } from "@playwright/test";
import { useSession } from "./fixtures.js";

test("RF-23: completed action enables a reviewed finding closure", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  const finding = { id: "FDG-782", title: "Excepción de control", description: "Diferencia observada",
    status: "OPEN", controlId: "CTL-782", controlTitle: "Conciliación", riskId: "RSK-782",
    riskTitle: "Registro incompleto", evaluationVersion: 1, storageVersion: 1,
    createdAt: "2026-10-21T12:00:00.000Z" };
  await page.route("**/api/controls/**", (route) => route.fulfill({ json: { controls: [] } }));
  await page.route("**/api/risks/**", (route) => route.fulfill({ json: { risks: [] } }));
  await page.route("**/api/findings/**", (route) => route.fulfill({ json: { findings: [finding] } }));
  await page.route("**/api/findings/FDG-782/close", async (route) => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toEqual({ version: 1,
      note: "El plan terminó y se revisó el resultado." });
    await route.fulfill({ json: { finding: { ...finding, status: "CLOSED", storageVersion: 2,
      closureNote: "El plan terminó y se revisó el resultado.", closedBy: { username: "auditor" },
      closedAt: "2026-10-21T13:00:00.000Z" } } });
  });
  await page.route("**/api/actions**", (route) => route.fulfill({ json: { actions: [{
    id: "ACT-782", sourceType: "FINDING", sourceId: finding.id, status: "DONE"
  }] } }));
  await page.goto("/controles");
  await expect(page.getByText("1/1 acciones terminadas")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar hallazgo" }).click();
  await page.getByRole("textbox", { name: "Conclusión del cierre" }).fill("El plan terminó y se revisó el resultado.");
  await page.getByRole("button", { name: "Confirmar cierre" }).click();
  await expect(page.getByText(/Cerrado por auditor/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar hallazgo" })).toHaveCount(0);
});
