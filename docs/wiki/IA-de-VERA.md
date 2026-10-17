# IA de VERA

El asistente de HU-34 ayuda a consultar auditorías, riesgos, controles, hallazgos, pendientes y evidencias permitidas. Está integrado en la aplicación, pero **no es un aprobador ni un operador autónomo**: no tiene herramientas para escribir o resolver expedientes.

## Qué ve el usuario

| Función | Qué devuelve | Límite visible |
| --- | --- | --- |
| Preguntar a VERA | Respuesta y registros citados o relacionados; enlaces internos construidos por el servidor. | Una cita confirma que la fuente pertenece al catálogo visible, no que toda la frase generada sea correcta. |
| Indicadores exactos | Conteos calculados por VERA para preguntas reconocidas; no llama a Azure. | Los filtros no reconocidos pasan a la ruta generativa y no deben fingir un conteo exacto. |
| Briefing de auditoría | Estado, riesgos, controles, hallazgos y pendientes autorizados; posible próximo paso en borrador. | La sugerencia es separada de los hechos calculados. |
| Consulta de evidencias | Fragmentos de PDF/TXT indexados y búsqueda opcional de archivos visibles. | No busca todo archivo existente; los límites de indexación se informan. |
| OCR de imagen | Extracción iniciada explícitamente para formatos admitidos cuando hay despliegue Azure compatible con visión. | Un PDF escaneado no se procesa como imagen en el alcance documentado. |
| Borrador de propuesta | Texto sugerido a partir de un riesgo visible para roles que pueden proponer. | Requiere revisión humana; no crea ni aprueba la propuesta. |

El detalle del flujo y la API está en [Copiloto contextual](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-copilot-evolution.md), [evidencias](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-evidence-content.md) y [borradores confirmados por humanos](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-human-confirmed-drafts.md).

## Controles implementados

1. `backend/routes/assistantRoutes.js` exige sesión, limita solicitudes y no expone claves.
2. Los servicios construyen contexto desde registros que el usuario puede consultar; un ID ajeno no amplía su alcance.
3. Azure devuelve IDs de fuentes; el backend filtra los IDs permitidos y crea los enlaces internos.
4. El historial de conversación es limitado y efímero. Al recargar o cerrar sesión no se conserva.
5. En producción, la IA requiere almacenes persistentes y `VERA_AI_ENABLED=true`; puede desactivarse por configuración del backend.

Los detalles de configuración, mediciones puntuales y presupuesto de aviso están en el [runbook de Azure OpenAI](https://github.com/humbertofigb15/VERA/blob/main/docs/hu34-azure-openai.md). El presupuesto alerta; no impone un corte automático de consumo.

## Evidencia de calidad de IA

- La [evaluación continua](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-continuous-evaluation.md) ejecuta escenarios sintéticos con respuestas simuladas del proveedor. Es reproducible y no gasta tokens de Azure.
- Las [corridas manuales](https://github.com/humbertofigb15/VERA/actions/workflows/ai-evaluation.yml) muestran resultado, commit, duración y artefacto JSON/Markdown.
- La [aceptación en producción](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-production-acceptance.md) es distinta: requiere una cuenta real, entorno identificado, registros autorizados y comparación humana de la respuesta.

**Interpretación correcta:** un check verde detecta regresiones de los contratos ensayados; no certifica exactitud general, ausencia de filtraciones ni que el despliegue actual use la misma configuración.
