# HU-34 · Asistente conversacional de VERA con Azure OpenAI

## Estado comprobado el 16 de octubre de 2026

- Se creó el grupo `rg-vera-ai-prod` y el recurso `vera-grc-ai-2026-csg` en `eastus2`, bajo la suscripción Azure a la que tiene acceso `A01412419@tec.mx`.
- El despliegue `vera-chat` usa `gpt-4.1-mini` versión `2025-04-14`, SKU `Standard`, capacidad inicial 5. Una llamada directa a Azure respondió `VERA AI OK` con 15 tokens de entrada y 4 de salida. Esto comprueba recurso, despliegue y clave, pero **no** comprueba aún la aplicación pública.
- Una llamada local de extremo a extremo a `POST /api/assistant/ask`, con sesión Director y Azure real, respondió correctamente sobre el flujo de Gobierno: HTTP 200, 1,499 ms del backend, 442 tokens de entrada y 38 de salida. Los datos del repositorio local son demo; esta medición no equivale a aceptación de producción.
- Se creó el presupuesto mensual `vera-ai-monthly` para `rg-vera-ai-prod`: **USD 10**, con notificaciones al correo universitario del propietario al 50 % y 100 %. Azure confirmó el presupuesto y la moneda USD. Esta alerta informa; no suspende automáticamente las solicitudes.
- La cuenta conectada a Vercel no tiene acceso al proyecto `figbo/vera`: la API respondió 403 y el usuario confirmó que no pertenece a ese proyecto. La activación en la URL actual requiere acceso de configuración para ese proyecto o la colaboración de su propietario.
- Los almacenes Supabase de producción siguen sujetos a la configuración del proyecto Vercel. VERA no enciende la IA allí mientras cuentas, planificación y riesgos/controles permanezcan en memoria.

## Diseño y límites

`/asistente` llama a `GET /api/assistant/status` y `POST /api/assistant/ask`. El backend verifica el JWT y consulta al usuario actual antes de construir el contexto. Para `AUDITOR` se incluyen solo auditorías asignadas, riesgos bajo su responsabilidad, controles relacionados y hallazgos de esos riesgos; el resto de los roles hereda el alcance de lectura de los módulos existentes. Los pendientes se generan con las reglas actuales de HU-17. Se mandan campos mínimos y hasta 20 registros por tipo al modelo; los conteos reflejan todo el conjunto visible. No se transmiten contraseñas, claves, archivos de evidencia ni historiales de comentarios.

El backend llama a `POST /openai/v1/chat/completions` con la clave en el encabezado `api-key`. El nombre del despliegue se envía como `model`. La clave nunca viaja al navegador. La respuesta se muestra como texto, y los vínculos relacionados los construye VERA con sus rutas conocidas; no acepta URLs propuestas por el modelo. La conversación solo existe en la sesión de la página y no ofrece herramientas de escritura. Solicitudes para aprobar o editar se remiten al módulo correspondiente. Si Azure falla, vence el tiempo de espera o limita tráfico, la API devuelve un mensaje controlado.

`VERA_AI_ENABLED=false` mantiene el asistente apagado. En producción, además exige `VERA_USER_STORE=supabase`, `VERA_PLANNING_STORE=supabase` y `VERA_RISK_CONTROL_STORE=supabase`; así evita presentar datos temporales como información real. El límite adicional es de 10 preguntas por usuario cada 15 minutos, además del límite global existente de 100 solicitudes por IP cada 15 minutos. Ambos límites son memoria por instancia en la arquitectura actual: **no son un tope de gasto ni un control distribuido**. La capacidad del despliegue limita velocidad, tampoco fija un presupuesto mensual.

## Activación en el Vercel que sirve VERA

1. El propietario de `figbo/vera` agrega a Carlos al proyecto con permiso para variables y redespliegues. Confirmar el proyecto y su URL antes de tocar configuración. No enviar claves por chat ni guardarlas en Git.
2. Confirmar que las once migraciones del proyecto Supabase VERA siguen aplicadas y que las variables de servidor `SUPABASE_URL`, `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` y `JWT_SECRET` están presentes. Aplicar la [guía de Supabase](supabase-planning.md) para los seis modos persistentes y retirar cuentas demo del entorno real.
3. Configurar **solo en el servicio backend** de Vercel: `AZURE_OPENAI_ENDPOINT=https://vera-grc-ai-2026-csg-e98a2.openai.azure.com`, `AZURE_OPENAI_DEPLOYMENT=vera-chat`, `AZURE_OPENAI_API_KEY` obtenida directamente desde el recurso Azure, y `VERA_AI_ENABLED=true`. No poner la clave en `VITE_*`, en el frontend, en GitHub Actions ni en capturas. Marcar la clave como sensible y seleccionar el entorno Production; Preview se configura aparte si se desea probarlo.
4. Redesplegar el commit fusionado. Iniciar sesión con una cuenta real de cada rol y abrir `/asistente`. `GET /api/assistant/status` debe indicar `available: true`. Consultar un riesgo y un pendiente existentes, verificar que los vínculos llevan al módulo correcto y que `AUDITOR` no recibe títulos de expedientes ajenos. Revisar los registros de Azure y Vercel sin mostrar prompts, respuestas privadas ni secretos.
5. Medir latencia, 429, 5xx y tokens consumidos durante una prueba corta. Revisar el costo y la alerta mensual de USD 10 en Azure Cost Management. Las alertas presupuestarias **no cortan automáticamente** el consumo. Para apagar de emergencia, cambiar `VERA_AI_ENABLED=false` y redesplegar; rotar la clave si se sospecha exposición.

## Evidencia de aceptación

| Criterio de la captura de HU-34 | Implementación y comprobación |
| --- | --- |
| Chat accesible y preguntas libres | Ruta protegida `/asistente`, texto de 3 a 800 caracteres y sugerencias. Prueba E2E de envío y estado sin configuración. |
| Información real sobre auditorías, riesgos, controles, hallazgos y pendientes | Contexto de repositorios existentes; en producción requiere almacenes persistentes. **Pendiente** prueba remota con datos de Supabase tras configurar Vercel. |
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
