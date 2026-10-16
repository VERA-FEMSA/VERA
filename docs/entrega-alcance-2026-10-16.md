# Entrega de alcance funcional y de calidad — 16 de octubre de 2026

## Decisión de entrega

El trabajo de código bajo este alcance quedó integrado en `main` hasta el commit `1cf77a46cf7235c81445bb62ecc922b5d2eb76eb`. Esta entrega acredita implementación y comprobaciones de PR; **no equivale a aceptación del despliegue con Supabase**. Los estados mostrados en las capturas de Azure DevOps se usan como contexto, no como prueba de aceptación.

La [matriz de aceptación](hu-acceptance-audit.md) documenta, HU por HU, la evidencia disponible y lo que falta para afirmar el 100 %. No se cambian estados de Azure DevOps desde este repositorio.

| Incremento | Evidencia revisable | Resultado |
| --- | --- | --- |
| HU-26: búsqueda y filtros de auditorías | [PR #55](https://github.com/humbertofigb15/VERA/pull/55) | Integrado en `main`; búsqueda sobre datos del backend con alcance por rol. |
| HU-15: hallazgos vinculados a controles y riesgos | [PR #56](https://github.com/humbertofigb15/VERA/pull/56) | Integrado; metadatos y vínculo persistente optativo. |
| HU-16: archivos privados de evidencia | [PR #57](https://github.com/humbertofigb15/VERA/pull/57) | Integrado; bucket privado y descarga autorizada. |
| HU-17: lectura individual de pendientes | [PR #58](https://github.com/humbertofigb15/VERA/pull/58) | Integrado; estado de lectura optativo en Supabase. |
| HU-07/HU-09: hallazgos reales en panel y expediente | [PR #59](https://github.com/humbertofigb15/VERA/pull/59) | Integrado; conteo y detalle restringidos por permisos. |
| HU-15: resultado efectivo o inefectivo | [PR #60](https://github.com/humbertofigb15/VERA/pull/60) | Integrado; resultado derivado de evaluación versionada. |

## Comprobaciones observadas

- Suite backend al cerrar el PR #60: **66/66 pruebas**, 0 fallas. El lint/syntax revisó 94 archivos JavaScript.
- Build y lint del frontend completados; la prueba local específica de HU-15 pasó en Chromium.
- Las comprobaciones de PR #60 informaron `pass` para calidad, CodeQL y E2E en Chrome, Edge, Firefox, móvil y tableta. La ejecución E2E tardó 2 min 55 s y la puerta de calidad 29 s. Son pruebas de código/fixtures, no de persistencia en producción.
- Los archivos modificados pasaron decodificación UTF-8 estricta y `git diff --check`.
- Las **11 migraciones** coinciden entre la carpeta versionada y el proyecto Supabase VERA (`rsrsycokfdypliepcxgi`). La [bitácora de Supabase](supabase-rollout-2026-10.md) distingue lectura real de API, aplicación de migraciones y comprobaciones aún no ejecutadas.

## Pendientes transferidos fuera de este alcance

| Responsable operativo | Trabajo pendiente | Criterio de cierre y evidencia |
| --- | --- | --- |
| Administración de `figbo/vera` | Configurar secretos y modos persistentes del backend en Vercel; desplegar en un entorno aislado. | Registrar commit desplegado, entorno y modos activados sin exponer claves. |
| Equipo de aceptación | Ejecutar con cuentas reales los flujos de auditorías, riesgos, controles, evidencias y pendientes; reiniciar el backend y confirmar los mismos IDs y estados. | Casos con pasos, resultado esperado/obtenido y defectos trazados; contrastar texto oficial completo de Azure DevOps. |
| Infraestructura y rendimiento | Preparar staging autorizado y ejecutar el workflow de carga de 150 y 250 usuarios virtuales. | Guardar fecha, commit, duración, VUs efectivos, latencia p95, tasa de error y limitaciones de la corrida. Un script sin ejecución no cuenta como resultado. |
| Dueños de producto y permisos | Reconciliar la matriz CRUD entregada con los roles reales de VERA antes de ampliar quién crea o evalúa controles. | Regla aprobada y pruebas por rol; no inferir correspondencia entre nombres de roles distintos. |

La persona que reciba esta entrega puede usar [la guía de activación](supabase-planning.md), [el plan de pruebas](testing/test-plan.md), [el runbook operativo](testing/operations-runbook.md) y [el acceso rápido de calidad](testing/professor-quick-run.md). Ningún pendiente de la tabla anterior se presenta como completado por haber pasado CI.

## Nuevo alcance propuesto: HU-34

El asistente conversacional es un sprint separado. Su contrato inicial será de **consulta de solo lectura**, con recuperación de registros permitidos al usuario, respuestas fundamentadas en esos registros y enlaces generados por VERA. Toda operación que modifique datos queda fuera de la primera entrega; no se habilitará sin un flujo de confirmación y autorización explícito. La integración utilizará Azure OpenAI, sin guardar claves en Git. No existe todavía un recurso/despliegue Azure OpenAI para VERA; por ello el código podrá verificarse con respuestas simuladas, pero la aceptación del servicio real seguirá pendiente de activación y prueba.
