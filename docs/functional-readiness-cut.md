# Corte funcional previo al siguiente sprint de IA

**Fecha:** 21 de octubre de 2026 (America/Mexico_City). Este documento es un corte del repositorio, no una certificación de Production. Para el estado cambiante de `main`, consulta el [portal de calidad](https://vera-grc-irm.github.io/VERA/), las [corridas](https://github.com/VERA-GRC-IRM/VERA/actions) y la [issue de aceptación #113](https://github.com/VERA-GRC-IRM/VERA/issues/113).

## Capacidades que ya tienen implementación revisable

| Recorrido | Evidencia de código | Límite de la afirmación |
| --- | --- | --- |
| Propuestas, decisiones y auditoría | [HU-22/23](https://github.com/VERA-GRC-IRM/VERA/wiki/Modulos-y-HU), edición, inicio y cierre de auditoría | El contrato exacto de RF-12 y sus campos debe cotejarse con TC-10 a TC-12 y los criterios oficiales. |
| Riesgos, controles y hallazgos | [Mapa de módulos](https://github.com/VERA-GRC-IRM/VERA/wiki/Modulos-y-HU), [cierre condicionado a acciones](rf23-cierre-hallazgos.md) | El ciclo completo, los permisos y la persistencia requieren aceptación desplegada con cuentas y datos sintéticos. |
| Evidencias, actividad y pendientes | [Mapa de módulos](https://github.com/VERA-GRC-IRM/VERA/wiki/Modulos-y-HU), [acciones de seguimiento](action-register.md) | No equivalen a entrega de notificaciones externas ni a una política de conservación aprobada. |
| Búsqueda, reporte y exportación | [Contrato RF-29](rf29-reportes-exportacion.md) | La descarga CSV funciona en código; RNF-15 exige definir un formato paginado antes de medir 100 páginas. |
| Panel por rol y periodo | [Contrato RF-06](rf06-periodos-panel.md) | El periodo usa el año y trimestre actuales de cada propuesta, no una fotografía histórica. |

## Evidencia de pruebas y aceptación

El [plan de 78 casos](testing/test-plan.md) y su [registro generado](testing/case-evidence-register.md) separan prueba relacionada de dictamen de aceptación. En este corte: **78/78** casos inventariados, **68** con archivos de prueba relacionados y **0** con un PASS individual declarado en Production. Las categorías de la línea base incluyen código relacionado, cobertura parcial, bloqueos y pruebas preparadas sin ejecución; ninguna de ellas debe convertirse automáticamente en aceptación.

La integración automática detecta regresiones de código, pero no sustituye la [revisión funcional en el despliegue](https://github.com/VERA-GRC-IRM/VERA/issues/113). La fecha, el SHA, la duración y el resultado vigente se consultan en el portal y en cada corrida, sin fijar aquí cifras que caducan al cambiar `main`.

## Decisión para iniciar IA sin ocultar pendientes

**Se puede iniciar el siguiente sprint de IA sobre los contratos actuales** cuando los PR funcionales [#165](https://github.com/VERA-GRC-IRM/VERA/pull/165), [#166](https://github.com/VERA-GRC-IRM/VERA/pull/166) y [#167](https://github.com/VERA-GRC-IRM/VERA/pull/167) estén fusionados y sus controles de `main` pasen. Eso fija interfaces para construir IA sin suponer que toda la aceptación empresarial o no funcional terminó.

Antes de presentar VERA como completamente aceptado en Production, siguen abiertas las seis comprobaciones de la [issue #113](https://github.com/VERA-GRC-IRM/VERA/issues/113): sesiones y roles reales; consulta real al asistente; persistencia tras redespliegue; 150/250 usuarios en staging; restauración aislada; y revisión humana de accesibilidad. El plan Free y la falta de staging aprobado limitan las pruebas de carga y respaldo. No se ejecutan contra Production para llenar una casilla.

También hay decisiones funcionales que requieren dueño del requisito: el alcance del expediente de auditoría en RF-12 (TC-10 a TC-12), la actividad reciente del panel (TC-07), el historial y los comentarios dentro del expediente (TC-51/52), el canal esperado de notificaciones (TC-20) y el formato paginado de RNF-15 (TC-68). La [issue #168](https://github.com/VERA-GRC-IRM/VERA/issues/168) las organiza y las filas están [identificadas en el plan](testing/test-plan.md); no se declaran resueltas por un PR vecino. Una decisión puede cerrar o cambiar el alcance con trazabilidad, pero no se debe simular una función no implementada.

## Alcance de producto

VERA tiene un flujo de auditoría, riesgo, control y evidencia útil para su alcance acordado. Eso **no demuestra que incluya todas las capacidades posibles de un GRC/IRM**. El [NIST CSF 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20) describe resultados de gestión de riesgo que una organización puede adaptar, y los [Global Internal Audit Standards del IIA](https://www.theiia.org/en/standards/2024-standards/global-internal-audit-standards/) describen obligaciones profesionales de auditoría. Ninguno convierte por sí mismo este prototipo en una solución universal o en una certificación de conformidad. Cualquier módulo adicional debe partir de requisitos y revisión de negocio, con su propia evidencia.
