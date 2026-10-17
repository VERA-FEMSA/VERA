# Evaluación continua del asistente

## Objetivo y alcance

La suite `ai-regression-v1` fija ejemplos sintéticos revisables en `backend/evaluations/ai-regression-v1.json`. Ejecuta el **adaptador real** de Azure OpenAI con `fetch` simulado y comprueba que la respuesta estructurada, los IDs de fuentes permitidas, los errores del proveedor y los detectores de respuestas problemáticas mantienen su comportamiento. Incluye un ejemplo que debe aceptarse y otro que debe rechazarse para cada uno de los ocho casos existentes; añade una cita de registro ajeno, un HTTP 429 y dos respuestas inválidas. Son 20 escenarios en la versión inicial.

Esta es una evaluación **previa a producción y determinista**. Sigue la idea de conjuntos repetibles y evaluación de calidad descrita por [Microsoft Foundry](https://learn.microsoft.com/en-us/azure/foundry/concepts/observability). No envía solicitudes al modelo, no consulta Supabase, no utiliza claves reales y no genera consumo de Azure. Sus tiempos p50/p95 miden únicamente el arnés local; no representan latencia del modelo. La detección textual es heurística y no certifica exactitud semántica, ausencia de fugas, autorización real por rol, rendimiento ni calidad de respuestas nuevas del modelo.

## Ejecución desde GitHub

1. Abre **Actions → AI continuous evaluation → Run workflow**.
2. Elige `main` y pulsa **Run workflow**. También puedes ejecutar desde una terminal autenticada:

   ```powershell
   gh workflow run ai-evaluation.yml --repo humbertofigb15/VERA --ref main
   ```

3. Abre la corrida. El job ejecuta todas las pruebas del backend y luego la suite sintética. El log muestra `PASS` o `FAIL` por escenario y duración. En **Summary** aparece la tabla de evaluación; en **Artifacts** se descargan `ai-evaluation.json` y `ai-evaluation.md`, retenidos 30 días.

Para localizar la corrida desde terminal:

```powershell
gh run list --repo humbertofigb15/VERA --workflow ai-evaluation.yml --limit 5
gh run view RUN_ID --repo humbertofigb15/VERA --log
```

El job falla si falla cualquier prueba backend o si el resultado observado de un escenario no coincide con su expectativa. Los artefactos contienen únicamente IDs sintéticos, estado, verificaciones booleanas, duración del arnés, SHA y hora UTC; no incluyen preguntas, respuestas, claves ni contexto. Si la suite no llega a ejecutarse, el artefacto puede faltar y debe revisarse el paso que falló.

## Ejecución local y mantenimiento

Desde la raíz, con Node.js 22 y las dependencias backend instaladas:

```powershell
npm ci --prefix backend
npm test --prefix backend
npm run ai:eval:offline --prefix backend
```

El último comando devuelve 0 con todos los escenarios conformes, 1 ante una regresión y 2 si el conjunto es inválido o falla el ejecutor. Escribe `quality-report/ai-evaluation.json` y `.md`, ignorados por Git. Al añadir un caso a `assistant-evaluation-cases.js`, añade controles positivo y negativo al JSON. La validación del conjunto impide omitirlos y rechaza IDs duplicados. Los tests `assistantOfflineEvaluation.test.js` también introducen deliberadamente una expectativa incorrecta para demostrar que aparece `FAIL`, y verifican que el informe no incluya el texto simulado.

## Lectura del resultado y siguiente nivel

Un `20/20` significa que el código actual conserva **estos contratos sintéticos**, no que 20 respuestas reales de Azure fueron correctas. Para revisar comportamiento del modelo, sigue disponible `npm run ai:eval --prefix backend` en un entorno controlado con configuración Azure; hace ocho consultas reales y puede generar costo. La [aceptación en producción](ai-production-acceptance.md) requiere sesión, datos reales y roles autorizados. Cualquier ampliación a evaluadores de modelo o pruebas periódicas con Azure debe aprobar datos, presupuesto y umbrales antes de añadir secretos al workflow.
