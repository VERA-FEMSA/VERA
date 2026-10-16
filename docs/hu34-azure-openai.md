# HU-34 · Asistente conversacional de VERA con Azure OpenAI

## Estado comprobado el 16 de octubre de 2026

- Se creó el grupo `rg-vera-ai-prod` y el recurso `vera-grc-ai-2026-csg` en `eastus2`, bajo la suscripción Azure a la que tiene acceso `A01412419@tec.mx`.
- El despliegue `vera-chat` usa `gpt-4.1-mini` versión `2025-04-14`, SKU `Standard`, capacidad inicial 5. Una llamada directa a Azure respondió `VERA AI OK` con 15 tokens de entrada y 4 de salida.
- Una llamada local de extremo a extremo a `POST /api/assistant/ask`, con sesión Director y Azure real, respondió correctamente sobre el flujo de Gobierno: HTTP 200, 1,499 ms del backend, 442 tokens de entrada y 38 de salida. Los datos del repositorio local son demo; esta medición no equivale a aceptación de producción.
- Se creó el presupuesto mensual `vera-ai-monthly` para `rg-vera-ai-prod`: **USD 10**, con notificaciones al correo universitario del propietario al 50 % y 100 %. Azure confirmó el presupuesto y la moneda USD. Esta alerta informa; no suspende automáticamente las solicitudes.
- Se creó el [fork de Carlos](https://github.com/CarlosSanchezGutierrez/VERA) y se conectó al proyecto `salva-ventures/vera` de su cuenta de Vercel. Su rama de producción es `main`; la instancia propia está en [vera-salva-ventures.vercel.app](https://vera-salva-ventures.vercel.app). No se configuraron secretos en `figbo/vera`, al que Carlos no tiene acceso; su integración existente con GitHub puede desplegar automáticamente los commits fusionados al `main` del equipo.
- En esta instancia, los seis almacenes usan el proyecto Supabase VERA (`rsrsycokfdypliepcxgi`), la IA está habilitada y `SUPABASE_SECRET_KEY`, `AZURE_OPENAI_API_KEY` y `JWT_SECRET` están en variables **Secret** solo del entorno Production. No están en Git ni en variables `VITE_*`.
- Prueba remota autenticada con rol `AUDITOR` activo y token temporal: `GET /api/assistant/status` respondió HTTP 200 con `available: true`; `POST /api/assistant/ask` respondió HTTP 200 en **2,591 ms**, con 298 tokens de entrada y 38 de salida. La pregunta sintética sobre el flujo de Gobierno obtuvo una respuesta coherente. Sin sesión, `/api/assistant/status` responde HTTP 401. La portada pública respondió HTTP 200. Son pruebas puntuales de integración, no aceptación visual de todos los roles ni auditoría de los datos existentes.
- Tras corregir el respaldo de rutas de Vite en el PR #64, el commit `8a99144` quedó `READY` en Vercel propio. Abrir directamente `/asistente` o `/login` respondió HTTP 200; el asset JS conservó tipo `application/javascript` y `/api/assistant/status` sin sesión, HTTP 401. Una nueva consulta autenticada respondió HTTP 200 en **1,995 ms** con 298 tokens de entrada y 28 de salida. Playwright mostró la pantalla de acceso al abrir `/asistente` sin sesión, sin errores de consola. El asset JS inspeccionado no contiene los valores de las tres claves de servidor; esto no reemplaza una auditoría completa de secretos.
- El dominio propio es público en Vercel y la aplicación sigue exigiendo inicio de sesión para consultar la IA. La cuenta universitaria `A01412419@tec.mx` no aparece actualmente entre las cuentas de VERA en Supabase; para usar la interfaz con esa identidad debe solicitar acceso y obtener aprobación conforme al flujo de cuentas. La sesión de Azure DevOps/Outlook no inicia sesión automáticamente en VERA.

## Diseño y límites

`/asistente` llama a `GET /api/assistant/status` y `POST /api/assistant/ask`. El backend verifica el JWT y consulta al usuario actual antes de construir el contexto. Para `AUDITOR` se incluyen solo auditorías asignadas, riesgos bajo su responsabilidad, controles relacionados y hallazgos de esos riesgos; el resto de los roles hereda el alcance de lectura de los módulos existentes. Los pendientes se generan con las reglas actuales de HU-17. Se mandan campos mínimos y hasta 20 registros por tipo al modelo; los conteos reflejan todo el conjunto visible. No se transmiten contraseñas, claves, archivos de evidencia ni historiales de comentarios.

El backend llama a `POST /openai/v1/chat/completions` con la clave en el encabezado `api-key`. El nombre del despliegue se envía como `model`. La clave nunca viaja al navegador. La respuesta se muestra como texto, y los vínculos relacionados los construye VERA con sus rutas conocidas; no acepta URLs propuestas por el modelo. La conversación solo existe en la sesión de la página y no ofrece herramientas de escritura. Solicitudes para aprobar o editar se remiten al módulo correspondiente. Si Azure falla, vence el tiempo de espera o limita tráfico, la API devuelve un mensaje controlado.

`VERA_AI_ENABLED=false` mantiene el asistente apagado. En producción, además exige `VERA_USER_STORE=supabase`, `VERA_PLANNING_STORE=supabase` y `VERA_RISK_CONTROL_STORE=supabase`; así evita presentar datos temporales como información real. El límite adicional es de 10 preguntas por usuario cada 15 minutos, además del límite global existente de 100 solicitudes por IP cada 15 minutos. Ambos límites son memoria por instancia en la arquitectura actual: **no son un tope de gasto ni un control distribuido**. La capacidad del despliegue limita velocidad, tampoco fija un presupuesto mensual.

## Operación del despliegue propio

1. Mantener las [once migraciones](supabase-planning.md) de Supabase y los seis modos `VERA_*_STORE=supabase`. Verificar en Vercel que `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_KEY` y `VERA_AI_ENABLED=true` correspondan al entorno Production. No copiar secretos a Preview, al frontend, a GitHub Actions ni a capturas.
2. Tras cada cambio aprobado en el `main` de `humbertofigb15/VERA`, revisar el commit y sincronizar el fork con `gh repo sync CarlosSanchezGutierrez/VERA --branch main` usando la cuenta propietaria del fork. No usar `--force` si la sincronización informa divergencia: investigar primero. Vercel despliega automáticamente el `main` del fork; confirmar el SHA y que el nuevo despliegue esté `READY`. Un merge en el repositorio del equipo **no** actualiza automáticamente esta instancia.
3. Validar `/asistente` con sesiones reales de los roles relevantes: consultar un riesgo y un pendiente existentes, seguir las referencias y comprobar que `AUDITOR` no ve expedientes ajenos. El smoke test remoto anterior verificó un solo rol con token temporal; queda pendiente esta aceptación funcional en la interfaz.
4. Medir latencia, respuestas 429/5xx y tokens en Vercel/Azure sin registrar prompts ni respuestas privadas. Revisar periódicamente el presupuesto mensual `vera-ai-monthly` de **USD 10**, con avisos al correo universitario al 50 % y 100 %. El presupuesto **no corta** el consumo automáticamente; la capacidad del modelo y el límite por usuario tampoco son un tope de gasto distribuido.
5. Para apagar la IA, cambiar `VERA_AI_ENABLED=false` en Production y redesplegar. Para una clave comprometida, rotarla en Azure, actualizar la variable Secret y redesplegar. Mantener el acceso a Vercel y Supabase limitado a operadores autorizados.

## Evidencia de aceptación

| Criterio de la captura de HU-34 | Implementación y comprobación |
| --- | --- |
| Chat accesible y preguntas libres | Ruta protegida `/asistente`, texto de 3 a 800 caracteres y sugerencias. Prueba E2E de envío y estado sin configuración. |
| Información real sobre auditorías, riesgos, controles, hallazgos y pendientes | Contexto de repositorios existentes; los seis almacenes están configurados en Supabase en la instancia propia y una consulta remota autenticada respondió correctamente. Queda pendiente la aceptación con registros reales representativos y cada rol. |
| Explica el flujo de Gobierno | Instrucción del flujo propuesta → revisión → decisión → ejecución → cierre. Requiere revisión humana de la respuesta en producción. |
| Respeta roles y no revela datos ajenos | Filtro de servidor antes de llamar al modelo; prueba unitaria con riesgo y hallazgo ajenos y control compartido. Se debe repetir con cuentas reales. |
| Navega al registro relacionado | La API devuelve rutas del servidor y la interfaz las presenta como enlaces; prueba E2E. |
| Reconoce falta de información | Instrucción explícita al modelo; verificar con caso sin datos reales. Un modelo generativo puede equivocarse: no usar la respuesta como aprobación formal. |
| Acciones con confirmación | Este alcance es de solo lectura y no expone ninguna acción de modificación; toda edición se realiza en los módulos con controles propios. |
| Manejo de errores | 400 para entrada inválida, 401 para falta de sesión, 503 sin configuración o persistencia, 429 para límite y 502/504 para proveedor/timeout. Pruebas de API y proveedor simulado. |

## Pruebas reproducibles

```powershell
cd backend
npm ci
node --test tests/assistant.test.js
cd ../frontend
npm ci
npx playwright test e2e/assistant.spec.js --project=chromium
```

No ejecutar pruebas con datos sensibles en prompts. La llamada directa a Azure ya ejecutada fue sintética y mínima; los tests automatizados usan un proveedor simulado para no incurrir en costo por cada PR.

En la rama de implementación, `npm run quality` terminó con **71/71 pruebas backend**, cobertura global **95.46 % de líneas**, sintaxis válida para 98 archivos y auditoría npm sin vulnerabilidades reportadas. El frontend pasó lint, build y auditoría npm sin vulnerabilidades reportadas. Las pruebas E2E de HU-34 cubren envío, indisponibilidad, móvil y revisión automatizada WCAG 2.1 A/AA; se ejecutan en CI en los navegadores configurados. Los tiempos son de esta ejecución local y pueden variar en CI.

## Referencias oficiales

- [Crear recurso y desplegar modelo](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/how-to/create-resource/)
- [API de chat v1 y autenticación](https://learn.microsoft.com/en-us/azure/foundry/openai/latest)
- [Cuotas y capacidad](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/quota)
- [Disponibilidad regional de modelos](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability)
