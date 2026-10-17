# Aceptación de vistas previas: sesiones y permisos de demostración

Este control complementa el [smoke público de producción](../../.github/workflows/production-smoke.yml). Comprueba que una vista previa aislada puede iniciar sesión y que la API aplica los permisos de cinco roles en rutas de **solo lectura**. Los E2E de interfaz usan respuestas controladas; esta ejecución llama a un backend desplegado.

## Incidente detectado y corrección de entorno

El 17 de octubre de 2026, una vista previa desplegada desde el PR #112 respondió HTTP 500 al iniciar sesión con una cuenta demo válida. El proyecto Vercel tenía `JWT_SECRET` en Production, pero no en Preview. Se añadió a Preview un **secreto diferente**, generado aleatoriamente y almacenado por Vercel como `Secret`; no se copió el de Production. La nueva vista previa `dpl_B2Cmx4C8Vs1rSqz4z8Tq1YXqPQxG` terminó `READY`. El inicio de sesión del rol Director y `GET /api/dashboard` respondieron 200.

La vista previa permanece pública por decisión del proyecto. Utiliza únicamente las cuentas y datos de demostración del modo `memory`; Preview no tiene configuradas claves de Supabase ni Azure OpenAI. No se deben introducir allí credenciales reales, datos privados o evidencias institucionales. El estado del asistente informa `available: false` y `persistent-stores-required`.

## Ejecución reproducible

En GitHub Actions, abrir **Preview role acceptance → Run workflow** e introducir la URL HTTPS generada por Vercel para una vista previa de VERA. El script admite los sufijos verificados `salva-ventures` y `carlos-sanchez-it` del mismo equipo de Vercel (identificador `team_3n1yQmMOuYFhA1ZPrKApnG7w`); rechaza la URL de producción, hosts externos, puertos, rutas y parámetros. No pide secretos de GitHub; obtiene las credenciales públicas de demostración del fixture versionado y mantiene los tokens de sesión solo en memoria durante la corrida.

El workflow escribe un resumen por rol, ruta, código HTTP y duración; conserva el JSON `vera-preview-roles-<run>-<attempt>` durante 14 días. El informe no incluye contraseñas, tokens, cuerpos de respuesta ni listados de usuarios. Si una comprobación falla, el job termina en error.

El contrato cubre 83 comprobaciones: tres rechazos anónimos, cinco inicios de sesión, consultas del panel, planificación, búsqueda, riesgos, controles, evidencias, notificaciones, hallazgos, actividad y estado del asistente; además, acceso permitido o denegado a usuarios, bitácora, responsables de riesgos y lista de auditores según cada rol. También comprueba que la lista visible al Super Admin contiene solo correos demo `@vera.local`.

**Línea base local:** el 17 de octubre de 2026 a las 23:45 UTC se ejecutó `node scripts/preview-role-acceptance.mjs` contra la nueva vista previa: **83/83 PASS**, 247–373 ms por solicitud, sin fallos. Una ejecución separada con la URL de producción terminó con código 2 antes de hacer peticiones, como exige el guard de destino. La corrida de Actions debe verificarse por separado después de integrar el workflow.

## Límite de la evidencia

Esta prueba usa cuentas conocidas, datos en memoria y solicitudes de lectura. No demuestra inicio de sesión con usuarios de Supabase, persistencia tras un nuevo despliegue, permisos sobre registros reales, carga de archivos, Azure OpenAI dentro de Production, accesibilidad humana ni capacidad de 150/250 usuarios. Esas puertas permanecen abiertas en [la issue de aceptación de producción](https://github.com/VERA-GRC-IRM/VERA/issues/113).
