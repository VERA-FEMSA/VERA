# Abrir la verificación completa de VERA

## Para revisar resultados sin instalar nada

1. Abre [Ejecución completa de calidad y pruebas en GitHub Actions](https://github.com/humbertofigb15/VERA/actions/workflows/classroom-quality.yml).
2. Entra a la ejecución más reciente, abre **Summary** y revisa resultado, commit, cantidad de pruebas y tiempos. Si está en rojo, lee el paso fallido; no la presentes como aprobada.
3. Si necesitas los logs detallados, el HTML de Playwright, las capturas, las trazas o los archivos JSON/Markdown, abre el artefacto de esa misma ejecución. El workflow lo conserva durante 30 días.

No hace falta clonar el repositorio, instalar Node, descargar navegadores ni ejecutar comandos localmente para revisar el resultado.

## Para iniciar una nueva ejecución

Pulsa **Run workflow** en esa página. GitHub ejecuta en una sola corrida:

- Calidad backend/frontend, pruebas unitarias y de integración, cobertura, lint, build y auditoría de dependencias. El número ejecutado se lee en la corrida, porque la suite cambia con el código.
- E2E en Chromium, Chrome, Edge, Firefox y perfiles emulados de móvil/tablet, incluida accesibilidad con axe en flujos seleccionados. El número de casos se lee en la corrida.
- CodeQL para JavaScript/TypeScript.

La ejecución publica un resumen ejecutivo en la pestaña **Summary** y un solo artefacto con bitácora y evidencia. También se genera automáticamente cada lunes.

GitHub solo permite iniciar manualmente workflows a usuarios con permiso de escritura en el repositorio. El enlace público sí permite a un usuario de solo lectura inspeccionar una ejecución ya iniciada. Para una presentación, comparte directamente la URL de la corrida reciente; el profesor no necesita permisos de escritura.

## Lo que no puede marcarse aprobado desde esta corrida

La matriz de [`test-plan.md`](test-plan.md) tiene 78 escenarios; algunos no corresponden todavía a una función implementada o requieren hardware, staging o evidencia operativa. La prueba de 150/250 usuarios es un workflow manual separado y requiere staging, una allowlist de hostname y una credencial de prueba. Las pantallas E2E usan fixtures de API; no son una prueba del backend desplegado. El resumen lista estos límites para evitar presentar una función planeada como aprobada.
