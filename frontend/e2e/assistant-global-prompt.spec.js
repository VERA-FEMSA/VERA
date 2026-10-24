import { test, expect } from "@playwright/test";
import { useSession, stubDashboard } from "./fixtures.js";

test("Una pregunta natural en la barra global abre IA con el texto listo, sin enviarlo sola", async ({ page }) => {
  await useSession(page, "GERENTE", 3);
  await stubDashboard(page, "GERENTE");
  await page.route("**/api/assistant/status", (route) => route.fulfill({ json: {
    available: true, conversations: true, mode: "consult-and-confirm"
  } }));
  await page.route("**/api/assistant/brief", (route) => route.fulfill({ json: { role: "GERENTE", signals: [] } }));
  await page.route("**/api/assistant/insights", (route) => route.fulfill({ json: { insights: [] } }));
  await page.route("**/api/assistant/conversations", (route) => route.fulfill({ json: { conversations: [] } }));
  let sent = 0;
  await page.route("**/api/assistant/ask", (route) => { sent += 1; return route.abort(); });
  await page.goto("/dashboard");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "Buscar secciones y acciones" });
  await search.getByRole("searchbox", { name: "Buscar secciones y acciones" })
    .fill("¿Qué riesgos requieren atención?");
  await expect(search.getByRole("button", { name: /Preguntar a VERA: ¿Qué riesgos/ })).toBeVisible();
  await page.keyboard.press("Enter");
  const assistant = page.getByRole("dialog", { name: "Copiloto VERA" });
  await expect(assistant).toBeVisible();
  await expect(assistant.getByRole("textbox", { name: "Tu pregunta" }))
    .toHaveValue("¿Qué riesgos requieren atención?");
  await expect(assistant.getByRole("textbox", { name: "Tu pregunta" })).toBeFocused();
  expect(sent).toBe(0);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.keyboard.press("Escape");
  await expect(assistant).toBeHidden();
  await page.keyboard.press("Control+Alt+k");
  await expect(assistant.getByRole("textbox", { name: "Tu pregunta" })).toHaveValue("");
});
