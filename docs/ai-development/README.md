# Desarrollo de VERA con asistentes de IA

## Para qué sirve esta guía

El repositorio comparte contexto y reglas de trabajo, **no entrena ni modifica el modelo** de la cuenta personal de cada integrante. Codex puede tomar `AGENTS.md` como instrucciones del proyecto; `CLAUDE.md` importa ese mismo archivo para Claude Code; `.github/copilot-instructions.md` da la entrada a Copilot. Un ChatGPT o Claude usado solo en la web necesita que se le adjunte el repositorio o los archivos pertinentes: tenerlos en GitHub no garantiza que los lea. Las instrucciones reducen errores, pero la revisión humana y las verificaciones automatizadas siguen siendo necesarias.

| Archivo | Propósito | Mantenimiento |
| --- | --- | --- |
| [`AGENTS.md`](../../AGENTS.md) | Reglas compartidas, invariantes y criterios de revisión | Fuente principal; mantener breve y verificable |
| [`CLAUDE.md`](../../CLAUDE.md) | Importa `AGENTS.md` en Claude Code | No duplicar reglas |
| [`.github/copilot-instructions.md`](../../.github/copilot-instructions.md) | Entrada breve para Copilot Chat y revisión | Repetir solo las reglas críticas |
| Esta página | Mapa, flujo y ejemplos para el equipo | Actualizar si cambian arquitectura o comandos |
| [Plantilla de PR](../../.github/pull_request_template.md) | Evidencia mínima para revisión humana | Ajustar cuando cambie el proceso |

La estructura sigue las guías oficiales de [Codex sobre `AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Claude Code sobre memoria de proyecto](https://code.claude.com/docs/en/memory) y [GitHub Copilot sobre instrucciones de repositorio](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions).

## Cómo comprobar afirmaciones

| Pregunta | Fuente que hay que inspeccionar | Límite de la evidencia |
| --- | --- | --- |
| ¿Qué comportamiento implementa hoy? | Ruta, middleware, controlador, repositorio, cliente y pruebas del commit | Una prueba con mocks no demuestra un entorno remoto |
| ¿Qué debería implementar una HU? | Criterios completos y decisión vigente del equipo | Un estado “Resolved” o una captura parcial no prueban aceptación |
| ¿Quién puede hacer una operación? | `backend/config/roles.js`, ruta y comprobación de propiedad/visibilidad en controlador | La navegación o una matriz histórica pueden diferir |
| ¿Persiste después de reiniciar? | `backend/config/storeModes.js`, repositorio, migración y prueba con el modo correcto | `memory` y mocks no prueban Supabase real |
| ¿Está en producción? | SHA desplegado, configuración del entorno y prueba autenticada | Un PR fusionado no demuestra que el despliegue use ese commit |

Si dos fuentes se contradicen, **no elijas la que parezca más conveniente**. Registra la discrepancia con ruta y línea, comprueba el historial o la decisión vigente y limita la conclusión a lo observado. No copies datos personales ni claves en el reporte.

## Mapa de cambios frecuentes

- **API o regla de negocio:** empieza por `backend/server.js` y la ruta pertinente; sigue a controlador, repositorio, reglas compartidas y prueba en `backend/tests/`. Busca también el consumidor en `frontend/src/services/` y la pantalla que lo usa.
- **Permisos:** lee `backend/config/roles.js`, `backend/middleware/`, la ruta y las comprobaciones de asignación dentro del controlador. Después sincroniza `frontend/src/constants/roles.js`, botones y pruebas. Evita inferir acceso de un nombre de rol.
- **Interfaz:** revisa `frontend/src/App.jsx`, `frontend/src/pages/`, componentes, estilos y cliente HTTP. Considera estados de carga/error/vacío, teclado, móvil y pruebas en `frontend/e2e/`.
- **Persistencia:** localiza el repositorio `memory`, el adaptador Supabase, `backend/config/storeModes.js`, migración correspondiente y `docs/supabase-planning.md`. Revisa compatibilidad y recuperación antes de tocar el proyecto remoto.
- **Asistente de VERA:** distingue instrucciones para *desarrollar el repositorio* de prompts usados por el *producto*. Las rutas y servicios del copiloto están en `backend/routes/assistantRoutes.js` y `backend/services/`; la evaluación sintética se documenta en [evaluación continua](../ai-continuous-evaluation.md). No uses un prompt como autorización de datos.
- **Calidad/CI:** consulta `package.json`, `scripts/quality.js` y `.github/workflows/`; registra el comando, su alcance, resultado y duración observados.

## Flujo recomendado para una tarea

1. Parte de `main` actualizado y comprueba que no estás pisando cambios ajenos.
2. Escribe en pocas líneas el objetivo, criterios observables y archivos afectados. Si falta un requisito decisivo, declara la suposición o pide el dato mientras avanzas en lo independiente.
3. Lee el flujo completo de datos y permisos antes de editar. Para un cambio sensible, traza entrada → validación → autorización → almacenamiento → respuesta → interfaz.
4. Haz el cambio mínimo coherente. Actualiza pruebas y documentación que describan el comportamiento modificado.
5. Ejecuta las verificaciones pertinentes y conserva resultados reales. Desde la raíz, los comandos definidos son:

   ```powershell
   npm ci --prefix backend
   npm ci --prefix frontend
   npm run quality
   ```

   `npm run quality` incluye sintaxis y pruebas con cobertura backend, ESLint y build frontend, y auditoría npm. Para pruebas de navegador, consulta `frontend/playwright.config.js` y el workflow `.github/workflows/e2e.yml`; requieren instalar navegadores. No necesitas repetir la instalación si ya está hecha.
6. Abre un PR enfocado y usa la plantilla. Revisa el diff y los checks. Si no pudiste comprobar un entorno real, déjalo explícito como pendiente.

## Prompt de inicio para quien use un chat genérico

> Analiza este checkout de VERA. Primero lee `AGENTS.md` y `docs/ai-development/README.md`. Después localiza los archivos y pruebas de mi tarea. Enumera qué está comprobado en el código, qué es requisito y qué sigue incierto. Antes de editar, dime qué flujo de datos y permisos tocarás. Al terminar, muestra el diff resumido, los comandos que realmente ejecutaste y los límites de tu verificación. No inventes resultados ni uses datos reales en ejemplos.

Si el chat no puede acceder al checkout, adjunta estos dos archivos y los archivos específicos de la tarea. Repite la lectura cuando cambie `main`; una copia pegada meses antes puede estar desactualizada.
