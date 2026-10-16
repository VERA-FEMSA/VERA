# Copiloto contextual de VERA

## Experiencia implementada

- El acceso flotante **Preguntar a VERA** abre un panel desde las pantallas protegidas. La página `/asistente` sigue disponible.
- En las tarjetas de riesgo y control, y en el expediente de auditoría, **Analizar con IA** abre el panel con ese registro en contexto. El servidor comprueba la visibilidad antes de incorporarlo; un ID ajeno recibe 404 sin revelar el título.
- Las sugerencias iniciales cambian según el rol. Una tarjeta de señales muestra conteos deterministas de riesgos altos, controles con efectividad inferior a 4, hallazgos abiertos, pendientes de prioridad alta y auditorías activas. Esos conteos no provienen del modelo.
- El usuario puede hacer preguntas de seguimiento. Las seis intervenciones recientes se envían como historial **no confiable** junto al contexto vigente. La conversación vive solo en la memoria de la página; **Nueva conversación** la elimina. No hay almacenamiento del chat en Supabase.
- El proveedor devuelve texto y IDs de fuentes. El servidor acepta solamente IDs que ya estén en el catálogo de registros visibles y construye enlaces internos. La interfaz separa **Registros citados** de **Registros relacionados** y advierte que se debe comprobar el expediente. Un ID válido no demuestra por sí solo que cada frase sea correcta.
- Azure se consulta en modo JSON y el servidor rechaza respuestas incompletas o de formato inválido. [La documentación de Microsoft](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/json-mode) aclara que JSON válido no garantiza un esquema ni exactitud factual; por eso el servidor valida la estructura y los IDs recibidos.
- El asistente puede proponer borradores de próximos pasos, pero no tiene herramientas de escritura ni permisos para aprobar o cambiar expedientes.

## Alcance y permisos

El backend verifica la sesión y vuelve a consultar los almacenes en cada pregunta. Para `AUDITOR`, incluye auditorías asignadas, riesgos propios y controles/hallazgos relacionados. Para `SUPER_ADMIN`, `DIRECTOR`, `GERENTE` y `JEFATURA`, la lectura actual de esos módulos es de portafolio completo; el copiloto replica ese alcance existente. No se considera que la interfaz o el prompt sean controles de autorización. Si cambian los permisos de los módulos, debe cambiar también esta política de lectura.

El modelo recibe campos reducidos, hasta 20 registros por tipo, conteos de todo el conjunto visible y hasta tres evaluaciones recientes del expediente enfocado. No recibe archivos de evidencia, contraseñas ni claves. El catálogo de fuentes se construye en el servidor. El historial que envía el navegador se limita a seis entradas de hasta 800 caracteres cada una y nunca amplía el conjunto de registros autorizados.

## Contrato de API

| Ruta | Uso |
| --- | --- |
| `GET /api/assistant/status` | Disponibilidad de Azure y almacenes requeridos. |
| `GET /api/assistant/brief` | Señales deterministas según los registros visibles del usuario. |
| `POST /api/assistant/ask` | `{ question, history?, focus? }`; `focus` admite `audit`, `risk`, `control` o `finding` y un ID visible. Devuelve `answer`, `citations`, `references`, `durationMs` y consumo de tokens. |

La respuesta HTTP lleva `Cache-Control: no-store`. Se mantienen el límite por usuario y la desactivación por `VERA_AI_ENABLED=false`. El presupuesto mensual de Azure **avisa**, pero no bloquea el gasto. La telemetría registra duración, rol, estado y tokens; no registra preguntas, respuestas ni contenido del contexto.

## Evaluación reproducible

Para una comprobación puntual de la **versión publicada** sin copiar claves Azure, usa la [guía de aceptación en producción](ai-production-acceptance.md). Requiere una cuenta activa de VERA; separa lo observado sin sesión de lo que falta verificar con datos y roles reales.

Desde `backend`, `npm run ai:eval` ejecuta cuatro consultas **sintéticas** al despliegue Azure configurado: dato con fuente, ausencia de información, instrucción maliciosa dentro de un título y borrador sin ejecución. Imprime una línea JSON por caso con estado, duración y tokens, más el total. Requiere las variables de Azure en el entorno local del operador; no consulta Supabase ni imprime claves o respuestas. Es una evaluación de muestra: una ejecución exitosa no certifica precisión general ni ausencia de filtraciones. Revisar manualmente respuestas de todos los roles con datos autorizados antes de declarar aceptación de producción.

Los escenarios automatizados de API y navegador cubren contexto, permisos, memoria de conversación, citas, indisponibilidad, navegación y diseño móvil. CI no llama a Azure; usa un proveedor simulado para evitar costo y resultados variables.

## Publicación y operación

1. Revisar el PR y sus controles de calidad antes de fusionar con `main`.
2. Sincronizar el fork `CarlosSanchezGutierrez/VERA` con el `main` del equipo, revisar el SHA desplegado en `salva-ventures/vera` y confirmar estado `READY`. Un merge en el repositorio del equipo no sincroniza automáticamente el fork.
3. Comprobar con cuentas reales por rol que el panel no muestre registros ajenos, que cada enlace abra un expediente visible y que el modelo admita ausencia de datos. Evitar capturas con información sensible.
4. Medir duración, 429/5xx, tokens y gasto. Si el proveedor presenta errores, cambiar `VERA_AI_ENABLED=false` en Production y redesplegar.

## Límites y siguiente evolución

El chat no persiste al cerrar o recargar la página. Las fuentes citadas son IDs de registros, no fragmentos textuales verificados. No se indexa el contenido de evidencias ni se hace búsqueda semántica. El panel no envía notificaciones proactivas, simula escenarios ni ejecuta flujos. Esas capacidades requieren diseño de datos y permisos por documento, indicadores de calidad y aprobación humana antes de agregar acciones. No se deben anunciar como implementadas en este PR.
