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

test("Evidencias IA: OCR de imagen es explícito y después permite consultar fragmentos", async ({ page }) => {
  await useSession(page, "GERENTE", 3);
  const evidence = { id: "EVD-IMG", title: "Captura de revisión", description: "Imagen del control.",
    evidenceType: "SCREENSHOT", entityType: "RISK", entityId: "RSK-IMG", entityTitle: "Riesgo de compras",
    author: { name: "Gerencia" }, createdAt: "2026-10-17T10:00:00.000Z",
    file: { mime: "image/png", size: 85000 } };
  await page.route("**/api/risks**", (route) => route.fulfill({ json: { risks: [] } }));
  await page.route("**/api/controls**", (route) => route.fulfill({ json: { controls: [] } }));
  await page.route("**/api/planning**", (route) => route.fulfill({ json: { proposals: [] } }));
  let ocrCalls = 0;
  await page.route("**/api/evidence/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/index-image")) {
      ocrCalls += 1;
      return route.fulfill({ json: { status: "ready", chunks: 1, cached: false, truncated: false } });
    }
    if (path.endsWith("/ask")) return route.fulfill({ json: { answer: "Revisión mensual.", mode: "generated",
      asOf: "2026-10-17T12:00:00.000Z", coverage: { indexedChunks: 1, includedChunks: 1, partial: false },
      citations: [{ sourceId: "evidence:EVD-IMG:chunk:0", evidenceId: evidence.id, title: evidence.title,
        pageNumber: null, excerpt: "Control revisado mensualmente.", path: "/evidencias#evidence-EVD-IMG" }] } });
    return route.fulfill({ json: { evidence: [evidence] } });
  });
  await page.goto("/evidencias");
  await page.getByRole("button", { name: "Consultar contenido con IA" }).click();
  const dialog = page.getByRole("dialog", { name: "Preguntar sobre Captura de revisión" });
  await expect(dialog.getByText(/envía esta imagen privada al recurso Azure/)).toBeVisible();
  expect(ocrCalls).toBe(0);
  await dialog.getByRole("button", { name: "Extraer texto de imagen con IA" }).click();
  await expect(dialog.getByText(/1 fragmento de imagen disponible/)).toBeVisible();
  expect(ocrCalls).toBe(1);
  await dialog.getByLabel("Pregunta sobre el contenido").fill("¿Con qué frecuencia se revisa el control?");
  await dialog.getByRole("button", { name: "Consultar archivo" }).click();
  await expect(dialog.getByText("Control revisado mensualmente.")).toBeVisible();
});

test("Evidencias IA: CSV ofrece consulta con fila y encabezados citados", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  const evidence = { id: "EVD-CSV", title: "Matriz de controles", description: "Resultados del periodo.",
    evidenceType: "REPORT", entityType: "RISK", entityId: "RSK-CSV", entityTitle: "Riesgo operativo",
    author: { name: "Auditoría" }, createdAt: "2026-10-22T10:00:00.000Z",
    file: { mime: "text/csv", size: 120 } };
  await page.route("**/api/risks**", (route) => route.fulfill({ json: { risks: [] } }));
  await page.route("**/api/controls**", (route) => route.fulfill({ json: { controls: [] } }));
  await page.route("**/api/planning**", (route) => route.fulfill({ json: { proposals: [] } }));
  await page.route("**/api/evidence/**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/ask")) return route.fulfill({ json: {
      answer: "El control de acceso figura como aprobado.", mode: "generated",
      asOf: "2026-10-22T12:00:00.000Z", coverage: { indexedChunks: 2, includedChunks: 1, partial: true },
      citations: [{ sourceId: "evidence:EVD-CSV:chunk:0", evidenceId: evidence.id, title: evidence.title,
        pageNumber: null, excerpt: "Fila 2: Control: Acceso; Estado: Aprobado",
        path: "/evidencias#evidence-EVD-CSV" }] } });
    return route.fulfill({ json: { evidence: [evidence] } });
  });
  await page.goto("/evidencias");
  await page.getByRole("button", { name: "Consultar contenido con IA" }).click();
  const dialog = page.getByRole("dialog", { name: "Preguntar sobre Matriz de controles" });
  await dialog.getByLabel("Pregunta sobre el contenido").fill("¿Qué estado tiene Acceso?");
  await dialog.getByRole("button", { name: "Consultar archivo" }).click();
  await expect(dialog.getByText("Fila 2: Control: Acceso; Estado: Aprobado")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Matriz de controles" })).toHaveAttribute("href", "/evidencias#evidence-EVD-CSV");
});

test("Evidencias IA: DOCX privado muestra texto citado sin prometer páginas", async ({ page }) => {
  await useSession(page, "AUDITOR", 5);
  const evidence = { id: "EVD-DOCX", title: "Informe Word", description: "Revisión de controles.",
    evidenceType: "DOCUMENT", entityType: "RISK", entityId: "RSK-DOCX", entityTitle: "Riesgo de acceso",
    author: { name: "Auditoría" }, createdAt: "2026-10-22T10:00:00.000Z",
    file: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1800 } };
  await page.route("**/api/risks**", (route) => route.fulfill({ json: { risks: [] } }));
  await page.route("**/api/controls**", (route) => route.fulfill({ json: { controls: [] } }));
  await page.route("**/api/planning**", (route) => route.fulfill({ json: { proposals: [] } }));
  await page.route("**/api/evidence/**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/ask")) return route.fulfill({ json: {
      answer: "La revisión es trimestral.", mode: "generated", asOf: "2026-10-22T12:00:00.000Z",
      coverage: { indexedChunks: 2, includedChunks: 1, partial: true },
      citations: [{ sourceId: "evidence:EVD-DOCX:chunk:1", evidenceId: evidence.id, title: evidence.title,
        pageNumber: null, excerpt: "Revisión trimestral sin excepción.",
        path: "/evidencias#evidence-EVD-DOCX" }] } });
    return route.fulfill({ json: { evidence: [evidence] } });
  });
  await page.goto("/evidencias");
  await page.getByRole("button", { name: "Consultar contenido con IA" }).click();
  const dialog = page.getByRole("dialog", { name: "Preguntar sobre Informe Word" });
  await dialog.getByLabel("Pregunta sobre el contenido").fill("¿Cada cuándo se revisa?");
  await dialog.getByRole("button", { name: "Consultar archivo" }).click();
  await expect(dialog.getByText("Revisión trimestral sin excepción.")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Informe Word" })).toHaveAttribute("href", "/evidencias#evidence-EVD-DOCX");
});
