# Aceptación puntual del copiloto en producción

La instancia propia de VERA es [vera-salva-ventures.vercel.app](https://vera-salva-ventures.vercel.app). El [script de comprobación](../scripts/verify-ai-production.ps1) usa solamente esa URL HTTPS. Está pensado para ejecutarse desde una terminal PowerShell 7, con una cuenta **activa de VERA**. La sesión de Outlook, Azure DevOps o GitHub no inicia sesión en VERA.

## Antes de ejecutar

1. Abre [VERA](https://vera-salva-ventures.vercel.app/login) e intenta entrar con tu cuenta de la aplicación. Si no tienes cuenta, usa [Crear cuenta](https://vera-salva-ventures.vercel.app/registro). El registro queda pendiente hasta que una persona administradora de VERA lo apruebe; no se debe crear ni activar una cuenta directamente en Supabase para saltarse ese flujo.
2. Ten a mano el nombre de usuario y, si corresponde, tu código de dos factores. **No pegues contraseña, código ni token en este chat, en una captura ni en un issue.** El script los pide de forma oculta en la terminal y no escribe archivos de resultados.
3. Desde la raíz del repositorio, ejecuta la parte pública sin credenciales:

```powershell
pwsh -NoProfile -File .\scripts\verify-ai-production.ps1 -PublicOnly
```

Cuando puedas iniciar sesión en VERA, ejecuta la aceptación autenticada:

```powershell
pwsh -NoProfile -File .\scripts\verify-ai-production.ps1
```

El recorrido básico hace **una** consulta al modelo por ejecución autenticada. Se puede pasar `-Username tu_usuario` para omitir la pregunta del nombre de usuario; la contraseña y el código 2FA siempre se solicitan de forma oculta. El destino está fijado en el script para evitar enviar credenciales a un host introducido por error.

Para aceptar el briefing y la consulta de contenido de un archivo, usa IDs de registros de prueba que la cuenta pueda leer:

```powershell
pwsh -NoProfile -File .\scripts\verify-ai-production.ps1 -AuditId 'AUD-ID-DE-PRUEBA' -EvidenceId 'EVD-ID-DE-PRUEBA'
```

El briefing puede hacer una consulta adicional a Azure y la evidencia otra; no los ejecutes en bucle. Para comprobar separación de permisos, inicia otra ejecución con una cuenta activa **sin acceso** a esa evidencia y el mismo ID:

```powershell
pwsh -NoProfile -File .\scripts\verify-ai-production.ps1 -EvidenceId 'EVD-ID-DE-PRUEBA' -ExpectEvidenceDenied
```

La segunda ejecución exige HTTP 404 sin mostrar contenido y termina sin llamar al modelo. `-ExpectEvidenceDenied` no acepta una cuenta autorizada como sustituto de la cuenta ajena. No pegues IDs reales ni nombres de expedientes privados en capturas públicas. Si no hay dos cuentas de prueba, registra esa verificación como pendiente, nunca como aprobada.

## Qué comprueba

| Paso | Resultado exigido |
| --- | --- |
| Portada y acceso anónimo | HTTP 200 en `/` y HTTP 401 en `/api/assistant/status` sin sesión. |
| Inicio de sesión | Cuenta activa; si hay 2FA, se completa antes de continuar. Una cuenta pendiente o deshabilitada termina con `BLOCK` y código de salida 2. |
| Disponibilidad | `/api/assistant/status` responde `available=true`; esto comprueba configuración Azure y almacenes persistentes. |
| Alcance por rol | `/api/assistant/brief` informa el mismo rol de la sesión y devuelve señales; `/api/risks` devuelve los riesgos visibles para esa cuenta. |
| Respuesta real | `/api/assistant/ask` responde HTTP 200 y texto no vacío; se muestran latencia y tokens, nunca el texto de la respuesta. |
| Dato y fuente | Si hay al menos un riesgo visible, el script lo enfoca y exige que la respuesta incluya su nivel, puntuación y una cita con ruta interna. Si no hay riesgos visibles, valida una pregunta general y marca esta parte `SKIP`. |
| Briefing opcional | Con `-AuditId` exige que el expediente autorizado, sus secciones y una ruta interna lleguen desde `/api/assistant/dossier/:id`. La sugerencia puede faltar sin invalidar los hechos. |
| Evidencia autorizada opcional | Con `-EvidenceId` exige respuesta generada y al menos un fragmento del mismo archivo con enlace interno; no imprime texto privado. Requiere un PDF/TXT legible. |
| Evidencia ajena opcional | Con `-EvidenceId` y `-ExpectEvidenceDenied` exige HTTP 404 para otra cuenta y no consulta el contenido. |

La revisión visual del copiloto debe mostrar la hora de consulta y, cuando haya registros citados, sus campos básicos junto al enlace. Es una copia tomada al responder: comprueba el expediente actual antes de actuar. El script de terminal anterior no imprime esos campos para evitar exponer información en capturas compartidas.

`PASS` significa que pasó esa comprobación puntual; `FAIL` deja código de salida 1. `SKIP` indica algo que no se pudo demostrar con esa cuenta. Los milisegundos son los medidos por la terminal y pueden variar. El script no guarda contraseña, token, pregunta, respuesta ni registros en archivos; no imprimas el tráfico HTTP detallado al compartir una captura.

## Revisión visual y de permisos

Con cada rol real que se quiera aceptar, entra en VERA y verifica en escritorio y móvil:

1. **Preguntar a VERA** abre el panel desde una ruta protegida y se cierra con Escape. El chat general conserva sus mensajes al navegar o reabrir el panel, cada expediente conserva su propio hilo y **Nueva conversación** elimina solo el hilo actual. Al recargar o cerrar sesión, se elimina el historial.
2. **Analizar con IA** abre el riesgo, control o auditoría seleccionado; la respuesta puede citar un registro y el enlace lleva al expediente correcto.
3. Una cuenta `AUDITOR` ve solo sus auditorías y riesgos asignados, y no obtiene información de un expediente ajeno al intentar abrir su enlace. Para demostrar separación entre roles se necesitan, como mínimo, dos cuentas aprobadas con datos de prueba conocidos.
4. Si faltan datos, el asistente lo reconoce. Una propuesta de acción se presenta como borrador y no modifica el expediente.

Esta verificación no certifica exactitud general del modelo, ausencia completa de filtraciones, compatibilidad de todos los dispositivos ni todos los criterios de HU-34. Una respuesta correcta a un único riesgo o archivo es evidencia de integración, no una auditoría de calidad del conjunto. Registra incidencias con rol, paso, estado HTTP y hora, sin incluir datos privados ni secretos. Para considerar la aceptación completa hacen falta resultados de una cuenta autorizada y otra ajena con datos de prueba conocidos; `SKIP` no cuenta como aprobación.

## Estado comprobado

El 16 de octubre de 2026, después de fusionar el PR #75 y sincronizar el fork, Vercel marcó `READY` el commit `b755ffbb5ae415fb99a91ddfaeb48193571eb119`. La ejecución **pública** del script devolvió HTTP 200 para la portada y HTTP 401 para el asistente sin sesión. La parte autenticada, el briefing y la consulta de archivos privados siguen pendientes de cuentas activas de VERA con datos de prueba conocidos.
