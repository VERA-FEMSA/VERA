import { test, expect } from "@playwright/test";
import { stubDashboard, useSession } from "./fixtures.js";

test("sidebar renders each permitted destination once without duplicate React keys", async ({ page }) => {
  await useSession(page, "DIRECTOR", 2);
  await stubDashboard(page, "DIRECTOR");
  const duplicateKeyWarnings = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Encountered two children with the same key")) {
      duplicateKeyWarnings.push(message.text());
    }
  });

  await page.goto("/dashboard");
  const navigation = page.locator(".sidebar nav");
  await expect(navigation.getByRole("button", { name: "Panel de Portafolio", includeHidden: true })).toHaveCount(1);
  await expect(navigation.getByRole("button", { name: "Asistente de IA", includeHidden: true })).toHaveCount(1);
  await expect(navigation.getByRole("button", { name: "Usuarios", includeHidden: true })).toHaveCount(1);
  expect(duplicateKeyWarnings).toEqual([]);
});
