# Verificación operativa de VERA — 17 de octubre de 2026

Esta bitácora distingue la aplicación desplegada, la base de datos y las suites de CI. El repositorio vigente es `VERA-GRC-IRM/VERA`; el corte de `main` examinado fue `80f149abba6bd4a4086d4511bce732c5b7bf9945`. Solo se usó una identidad sintética inexistente para el intento de acceso. No se publican claves, cuentas reales ni filas privadas.

## Aplicación y Supabase

| Verificación | Resultado observado | Alcance exacto |
| --- | --- | --- |
| Proyecto Supabase tras activar SSL | `ACTIVE_HEALTHY`; `ssl-enforcement get` informó `database: true`. | Salud de plataforma; no prueba todos los clientes SQL directos. |
| URL propia `https://vera-salva-ventures.vercel.app/` | HTTP 200, 852 ms. | La pantalla de acceso está disponible. |
| `GET /api/dashboard` sin sesión | HTTP 401, 296 ms. | La ruta protegida rechaza una solicitud anónima; no prueba todos los permisos. |
| `POST /api/auth/login` con identidad sintética inexistente | HTTP 401, 2 284 ms. | El backend respondió sin error de almacenamiento; el intento genera un evento de auditoría previsto. |
| Consulta de solo lectura posterior en `public.vera_audit_events` | Un evento `LOGIN_FAILED` con prefijo sintético en la hora anterior. | Confirma que **esta ruta desplegada escribió en Supabase** y que otra conexión pudo leerlo. No prueba inicio de sesión válido, reinicio de backend, propuestas, archivos ni aislamiento entre usuarios. |
| Historial de migraciones | 14 versiones y nombres en el panel; SQL confirmó `count(*) = 14`. | Coinciden con los 14 archivos versionados. No se comparó el texto íntegro de cada migración con el SQL remoto. |
| Privilegios SQL de `public.vera_users` | `anon` SELECT `false`; `authenticated` SELECT `false`; `service_role` SELECT `true`. | Comprueba esta tabla y este privilegio; no sustituye pruebas RBAC en la API. |
| Bucket `vera-evidence` | `public = false`. | No se probó carga ni descarga con una sesión de VERA. |

Las seis variables `VERA_*_STORE` del proyecto Vercel propio figuraban como `supabase`, y `SUPABASE_URL` apuntaba al proyecto `rsrsycokfdypliepcxgi`. Se revisaron nombres y valores de configuración no secretos; no se extrajeron valores de claves de Vercel.

## Secreto histórico

La [alerta #1 de GitHub](https://github.com/VERA-GRC-IRM/VERA/security/secret-scanning/1) señalaba una `supabase_secret_key` de un `.env` histórico. El mismo valor aparecía allí tanto en `SUPABASE_SERVICE_ROLE_KEY` como en `VITE_SUPABASE_KEY`, nombre que podría exponerlo en una compilación del navegador si se utilizara. No se comprobó si llegó a publicarse en un bundle anterior. Se probó **solo ese valor antiguo** contra los endpoints REST y Auth del proyecto indicado en el mismo archivo: ambos devolvieron HTTP 401. El panel mostró una sola clave secreta activa, denominada `backend_vera`, con un prefijo distinto. La alerta se cerró como `revoked` con esta evidencia; una consulta posterior devolvió cero alertas abiertas. No se rotó ni reveló la clave activa, y no se modificaron variables de Vercel. Como prevención adicional se retiraron en el PR de limpieza los dos módulos `supabase-client.js` sin importaciones que leían `VITE_SUPABASE_KEY`. Cualquier cliente futuro del navegador deberá usar exclusivamente una clave publicable.

## Trazabilidad del despliegue

El último deployment `READY` de producción del proyecto Vercel propio era `dpl_5W9aAkgFFqXtT7s9b29U4njcHn8Z`, SHA `e50f9e6a1b238e7edb7d385b3f314e074f4c46c0`. El `main` vigente estaba ocho commits después. La página de Git en Vercel indicaba `Project Link not found`: seguía enlazada a `CarlosSanchezGutierrez/VERA`, nombre que GitHub ya no resuelve. Se retiró **únicamente ese enlace roto**; Vercel confirmó `Disconnected Git Repository successfully` y conservó proyecto, configuración y deployments. La URL continuó sirviendo la aplicación durante la revisión; una segunda petición GET después de desconectar el enlace devolvió HTTP 200 en 577 ms. La reconexión a `VERA-GRC-IRM/VERA` requiere completar la verificación de identidad de GitHub e instalar la app Vercel con acceso limitado a ese repositorio. Hasta completarla, **no hay despliegues automáticos de esta aplicación** ni se afirma que el SHA de `main` esté publicado.

## Carga, recuperación y accesibilidad

- **150/250 usuarios:** no ejecutado. El formulario de Supabase Free impidió crear un segundo proyecto en la organización: dos administradores ya alcanzaron su límite de proyectos gratuitos. No se pausó ningún proyecto ajeno ni se hizo una prueba de carga contra producción. Docker local no tenía un daemon activo. El workflow k6 permanece preparado para un staging aislado y un token de prueba autorizado.
- **Restauración:** no demostrada. El plan Free no ofrece un respaldo restaurable en el panel; la CLI informó `backups: []` y `pitr_enabled: false`. Sin copia verificable y destino aislado no corresponde simular una restauración ni declarar un RTO.
- **Accesibilidad manual parcial:** en la pantalla de acceso desplegada, el foco por teclado avanzó de correo a contraseña, después a `Iniciar sesión` y a `Crear cuenta`. El enlace enfocado mostró un contorno de foco en el navegador. La vista de accesibilidad expuso etiquetas de los campos. Falta lector de pantalla, navegación del resto de la aplicación, zoom y dispositivos físicos; este examen no certifica WCAG.

## Puertas aún abiertas

1. Completar la conexión de Vercel con el repositorio de la organización; publicar una vista previa del SHA vigente, revisar su compilación y sus rutas, y promoverla solo tras verificarla. Registrar URL, SHA y resultado posterior.
2. Preparar staging aislado con cuota disponible y datos sintéticos. Allí probar sesiones por rol, permisos negativos, lectura/escritura tras reinicio, archivos y la carga k6. No reutilizar la base de producción para 150/250 VUs.
3. Obtener una copia recuperable y restaurarla en un destino aislado; medir integridad, duración y punto de recuperación antes de declarar continuidad.
4. Completar pruebas humanas de teclado y lector de pantalla en flujos representativos, además de dispositivos físicos.

Los [78 casos del plan](test-plan.md) siguen trazados individualmente. Los resultados anteriores son evidencia acotada de producción y configuración; **no convierten los 78 casos en aprobados**.

## Actualización posterior: publicación del `main` vigente

Después de la revisión anterior se creó una vista previa del commit `590469cfd03219f98a0c7d01495816e7d634fa9c` desde `VERA-GRC-IRM/VERA` en el proyecto Vercel `salva-ventures/vera`: deployment `dpl_5yEhkXYkZWewzqgRTkBaoSDSqrQs`, estado `READY`. El log de compilación confirmó el repositorio, rama y SHA; terminó sin errores de build. La vista previa devolvió HTTP 200 en `/` y HTTP 401 sin sesión en `/api/dashboard` y `/api/assistant/status`.

Se publicó ese mismo SHA en Production como `dpl_2NcrvnWY9MeEh4GHRZB4znz9FYrq` (`READY`). Vercel asignó el dominio `https://vera-salva-ventures.vercel.app` a ese deployment. El despliegue anterior `dpl_5W9aAkgFFqXtT7s9b29U4njcHn8Z` queda identificado como candidato de reversión. El smoke posterior obtuvo: `/` HTTP 200 (613 ms); `/api/dashboard` 401 (403 ms); `/api/assistant/status` 401 (354 ms); `/api/risks` 401 (336 ms); `/api/evidence` 401 (256 ms). Un inicio de sesión con una identidad sintética inexistente devolvió 401 en 1 844 ms; no se imprimieron las credenciales sintéticas. Los primeros registros de ese deployment mostraron dos entradas informativas y ningún error; la muestra es insuficiente para una conclusión de estabilidad prolongada.

El script [`scripts/production-smoke.mjs`](../../scripts/production-smoke.mjs) repite una comprobación pública y anónima, genera JSON con fecha, respuestas y duración, y falla si alguna respuesta cambia inesperadamente. El workflow `Production smoke` lo ejecuta cada dos horas o bajo demanda y conserva el artefacto durante 14 días. **Esta comprobación no prueba una sesión autorizada, persistencia en Supabase ni una respuesta de IA dentro de VERA.** Después de la publicación manual, `vercel git connect` conectó el proyecto existente al repositorio de la organización. Una lectura posterior de la API de Vercel confirmó `type: github`, `org: VERA-GRC-IRM`, `repo: VERA`, `repoId: 1388329757` y `productionBranch: main`. Los siguientes pushes deben comprobarse con un deployment real para demostrar que la automatización opera de extremo a extremo.

Azure OpenAI respondió hoy a una consulta sintética directa al despliegue `vera-chat` en 1 800 ms. En `rg-vera-ai-prod` se configuró el grupo de acción `vera-ai-ops`, con correo universitario del propietario, y tres reglas verificadas: un 5xx del proveedor en 15 minutos (severidad 2), al menos cinco 429 en 15 minutos (severidad 3), y tiempo promedio de respuesta superior a 10 segundos en 15 minutos (severidad 3). Se evalúan cada cinco minutos con métricas **propias de Azure OpenAI** (`AzureOpenAIRequests`, `AzureOpenAITimeToResponse`); el límite de latencia es una señal inicial que requiere calibración con tráfico real y tokens generados. El presupuesto mensual de USD 10 permanece como aviso, no como corte de gasto.

La publicación del SHA vigente elimina la brecha de versión constatada antes, pero quedan abiertas las pruebas autenticadas por rol, la aceptación end-to-end de IA sobre este deployment, la comprobación de un push/deployment automático posterior, el staging aislado para 150/250 VUs, la restauración comprobada y la revisión humana de accesibilidad. No se ejecutó carga contra producción ni se modificaron datos de usuarios existentes.
