import { test, expect } from "@playwright/test";
import { useSession, stubDashboard } from "./fixtures.js";

const prepare = async (page, role) => {
  await stubDashboard(page, role);
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: {
    available: true, conversations: true, mode: role === "DIRECTOR" ? "read-only" : "consult-and-confirm"
  } }));
  await page.route("**/api/assistant/brief", (route) => route.fulfill({ json: { role, signals: [] } }));
  await page.route("**/api/assistant/insights", (route) => route.fulfill({ json: { insights: [] } }));
  await page.route("**/api/assistant/conversations", (route) => route.fulfill({ json: { conversations: [] } }));
};

test("El acceso global abre el asistente operativo desde el panel sin navegar", async ({ page }) => {
  await useSession(page, "GERENTE", 3);
  await prepare(page, "GERENTE");
  await page.goto("/dashboard");
  const button = page.getByRole("button", { name: "Abrir asistente de IA" });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-keyshortcuts", "Control+Alt+K Meta+Alt+K");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Buscar secciones y acciones" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Alt+k");
  const drawer = page.getByRole("dialog", { name: "Copiloto VERA" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Consulta y opera según tu rol")).toBeVisible();
  await expect(drawer.getByText("Consultas y acciones")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("El acceso global presenta la capacidad de Director como consulta", async ({ page }) => {
  await useSession(page, "DIRECTOR", 2);
  await prepare(page, "DIRECTOR");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Abrir asistente de IA" }).click();
  const drawer = page.getByRole("dialog", { name: "Copiloto VERA" });
  await expect(drawer.getByText("Solo lectura")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});
