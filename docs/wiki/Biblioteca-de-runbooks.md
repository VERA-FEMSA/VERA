# Biblioteca de runbooks y documentos fuente

Esta página evita buscar archivos a ciegas. La Wiki resume y conecta; los documentos de `main` conservan instrucciones detalladas y se revisan mediante PR. **Lee la fecha y el entorno de cada documento**: un informe histórico no se actualiza por sí solo cuando cambia un despliegue.

## Producto y aceptación

| Documento | Uso |
| --- | --- |
| [Estado de aceptación por HU](https://github.com/humbertofigb15/VERA/blob/main/docs/hu-acceptance-audit.md) | Fotografía fechada de implementación y verificaciones pendientes. |
| [Entrega de alcance](https://github.com/humbertofigb15/VERA/blob/main/docs/entrega-alcance-2026-10-16.md) | Corte histórico del trabajo integrado y transferencias operativas. |
| [Correspondencia de permisos HU-11](https://github.com/humbertofigb15/VERA/blob/main/docs/permissions/hu11-crud-mapping.md) | Contexto de matriz CRUD y discrepancias; contrasta con rutas vigentes. |

## Datos, despliegue y operación

| Documento | Uso |
| --- | --- |
| [Guía de Supabase](https://github.com/humbertofigb15/VERA/blob/main/docs/supabase-planning.md) | Migraciones, modos, dependencias y comprobación de persistencia. |
| [Rollout Supabase](https://github.com/humbertofigb15/VERA/blob/main/docs/supabase-rollout-2026-10.md) | Bitácora histórica de activación; verifica el estado actual antes de operar. |
| [Runbook operativo](https://github.com/humbertofigb15/VERA/blob/main/docs/testing/operations-runbook.md) | Ejecución e interpretación de verificaciones. |

## Calidad

| Documento | Uso |
| --- | --- |
| [Plan de pruebas](https://github.com/humbertofigb15/VERA/blob/main/docs/testing/test-plan.md) | Casos, trazabilidad, criterios y escenarios que requieren entorno. |
| [Guía rápida docente](https://github.com/humbertofigb15/VERA/blob/main/docs/testing/professor-quick-run.md) | Revisar calidad desde GitHub sin instalación local. |
| [Evaluación continua de IA](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-continuous-evaluation.md) | Suite reproducible y sus límites de interpretación. |

## Asistente de VERA

| Documento | Uso |
| --- | --- |
| [HU-34 y Azure OpenAI](https://github.com/humbertofigb15/VERA/blob/main/docs/hu34-azure-openai.md) | Configuración, evidencia y operación del proveedor. |
| [Copiloto contextual](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-copilot-evolution.md) | Experiencia, fuentes, memoria de sesión y límites. |
| [Aceptación en producción](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-production-acceptance.md) | Verificación con sesión y datos del entorno. |
| [Contenido de evidencias](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-evidence-content.md) | PDF/TXT, extracción de imágenes y permisos. |
| [Búsqueda unificada](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-unified-evidence-search.md) | Fragmentos citados, alcance y límites de cobertura. |
| [Prioridades e insights](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-prioritized-insights.md) | Señales calculadas y presentación de decisiones. |
| [Borradores confirmados](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-human-confirmed-drafts.md) | Sugerencias de IA y revisión humana. |
| [Feedback y calidad](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-feedback-quality.md) | Valoraciones y lectura de calidad del asistente. |

## Desarrollo con asistentes de código

| Documento | Uso |
| --- | --- |
| [Guía de desarrollo con IA](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-development/README.md) | Contexto, comandos y límites de Codex, Claude y Copilot. |
| [Ficha de tarea](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-development/task-brief.md) | Requisito preciso antes de editar. |
| [Comprobación de preparación](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-development/agent-readiness.md) | Lectura de solo diagnóstico sobre el repo. |

Si falta un documento, busca en [`docs/` del commit actual](https://github.com/humbertofigb15/VERA/tree/main/docs) y actualiza esta biblioteca.
