# Bitácora de conciliación de Supabase VERA — 15 y 16 de octubre de 2026

## Entorno y alcance

- Proyecto Supabase del equipo: `VERA`, referencia `rsrsycokfdypliepcxgi`.
- Repositorio: `humbertofigb15/VERA`; código de la octava migración en `5cc0580` (`main`).
- Ejecución: CLI de Supabase desde una terminal local autenticada, con migraciones versionadas del repositorio. Ninguna clave o contraseña se guarda en este informe.
- Esta bitácora registra la **preparación de la base y una lectura integrada local**. No representa la activación de los modos persistentes en Vercel.

## Conciliación previa

Antes de aplicar cambios se revisaron el historial de migraciones y las tablas ya existentes. `vera_audit_proposals` tenía 1 fila, `logins` 59 y `public.users` 10. Se compararon columnas, restricciones, índices y RLS de las dos primeras tablas con las migraciones que usan `create table if not exists`; por ello se conservaron sin recrearlas. La propuesta refería a los usuarios 1 y 4. Ocho cuentas antiguas tenían hashes bcrypt; dos cuentas inactivas tenían contraseñas en otro formato. La octava migración rechaza cualquier cuenta **activa** sin hash y transforma en PostgreSQL las contraseñas de las inactivas, sin mostrar su contenido.

## Cambios aplicados

1. `supabase db push --dry-run` confirmó el plan; `supabase db push` aplicó las seis migraciones iniciales. Los conteos previos permanecieron intactos.
2. [PR #51](https://github.com/humbertofigb15/VERA/pull/51) añadió la séptima migración. Se aplicó tras el merge: `service_role` quedó solo con `INSERT` en `logins`; `anon` y `authenticated` no tienen privilegios SQL en `logins` ni en las tablas antiguas. Los datos no cambiaron.
3. [PR #52](https://github.com/humbertofigb15/VERA/pull/52) añadió la octava migración. Se probó primero con `BEGIN`/`ROLLBACK`: copió 10 cuentas, generó 10 hashes bcrypt y conservó las referencias, sin dejar filas al deshacer. Tras el merge, se aplicó al proyecto remoto.
4. `supabase migration list` confirmó que las ocho versiones locales y remotas coincidían.

## Evidencia remota después de la migración

| Comprobación | Resultado |
| --- | ---: |
| Cuentas antiguas en `public.users` | 10 |
| Cuentas migradas en `vera_users` | 10 |
| Hashes bcrypt de 60 caracteres en `vera_users` | 10 |
| Propuestas conservadas | 1 |
| Referencias de usuarios en esa propuesta | 2 presentes, 0 faltantes |
| Diferencias en ID, identidad, rol, estado, 2FA y fechas entre ambas tablas | 0 |
| Eventos `VERA_USERS_INSERT` generados por trigger | 10 |
| Registros previos en `logins` | 59, conservados |

Con una clave de servidor obtenida de forma transitoria en la terminal, `node backend/scripts/check-user-links.js` informó: `Cuentas: 10; propuestas: 1; referencias sin cuenta: 0.` La clave no se imprimió ni se añadió a archivos del repositorio.

## Lectura integrada con Supabase real

Se inició la API Express local con los cinco modos `VERA_*_STORE=supabase` y se enviaron solicitudes `GET` con un token sintético de corta duración para un ID existente. Los seis endpoints devolvieron HTTP 200:

```text
PASS /api/planning HTTP 200
PASS /api/dashboard HTTP 200
PASS /api/risks HTTP 200
PASS /api/controls HTTP 200
PASS /api/evidence HTTP 200
PASS /api/audit HTTP 200
```

Esta comprobación demuestra conexión y lectura desde el backend local. El token sintético no verifica una contraseña real, 2FA ni el inicio de sesión del despliegue. Tampoco se hizo una escritura de prueba en producción ni se comprobó persistencia después de reiniciar el backend desplegado.

## Calidad y despliegue

- PR #51: `npm run quality` pasó en 148.37 s, con 53/53 pruebas backend y 96.49 % de líneas, 80.1 % de ramas y 94.31 % de funciones cubiertas.
- PR #52: `npm run quality` pasó en 42.14 s con las mismas 53 pruebas y cobertura. GitHub Actions informó `pass` para calidad, CodeQL y UI E2E en Chrome, Edge, Firefox, móvil y tableta; Vercel informó despliegue de *preview* completado. Estos resultados no demuestran que la base esté activada en ese despliegue.
- La cuenta que realizó la verificación no tiene acceso al proyecto de Vercel `figbo/vera`. Por ello no se modificaron sus variables de entorno ni se verificó la aplicación desplegada con los almacenes persistentes.

## Pendiente para cerrar la aceptación

La persona administradora de `figbo/vera` debe conceder acceso al proyecto o configurar las variables de servidor en Vercel: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (o clave legacy), `VERA_PLANNING_STORE`, `VERA_USER_STORE`, `VERA_RISK_CONTROL_STORE`, `VERA_EVIDENCE_COMMENT_STORE` y `VERA_AUDIT_STORE`, estas cinco últimas con valor `supabase`. También debe revisar los dominios institucionales y el secreto JWT del entorno sin publicarlos. La [guía](supabase-planning.md) detalla el orden de activación.

Después del despliegue, con cuentas autorizadas, comprobar inicio y cierre de sesión, permisos por rol y asignación, creación y aprobación de una propuesta, escritura y lectura de riesgos/controles/evidencias, eventos de bitácora, y los mismos IDs y estados después de reiniciar. Registrar resultados sin claves ni datos personales. La tabla antigua `public.users` continúa conservada: evaluar su retiro solo después de identificar todos sus consumidores.
