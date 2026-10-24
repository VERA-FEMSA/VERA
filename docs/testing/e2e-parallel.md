# Pruebas de interfaz en paralelo

El workflow `Browser and accessibility tests` ejecuta los mismos proyectos Playwright de `frontend/playwright.config.js` en seis trabajos independientes: Chromium de escritorio, Firefox, móvil Chromium, tablet Chromium, Google Chrome y Microsoft Edge. Cada trabajo conserva su reporte HTML, capturas, trazas y video bajo un nombre de artefacto propio. `fail-fast: false` permite observar todos los resultados aunque falle uno.

El control requerido para `main` sigue llamándose `UI E2E (Chrome, Edge, Firefox, mobile/tablet)`. Es un trabajo de síntesis que **sólo pasa si los seis proyectos terminan correctamente**; no reemplaza casos ni convierte fallas parciales en éxito. El workflow conserva los mismos disparadores de PR, push a `main` y ejecución manual.

Para investigar una falla, abre el trabajo `Browser E2E / <navegador>` correspondiente y descarga su artefacto `vera-e2e-<navegador>-<run>-<intento>`. El tiempo total de la corrida depende del trabajo más lento y de la capacidad disponible en GitHub Actions; no se promete una reducción fija hasta medirla en una ejecución real.
