# Persistencia de propuestas y auditorías en Supabase

HU-07 y HU-09 exigen que los indicadores y la matriz consulten datos almacenados. La API puede usar Supabase para las propuestas y auditorías que alimentan ambas vistas. El modo predeterminado `memory` conserva el demo y sus pruebas locales.

## Activación

1. Aplica las [migraciones versionadas](../supabase/migrations/) en un proyecto Supabase bajo control del equipo. Las tablas de planificación y bitácora de accesos no admiten lectura directa con claves públicas.
2. Configura **solo en el backend** `VERA_PLANNING_STORE=supabase`, `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. También se acepta `SUPABASE_SERVICE_ROLE_KEY` en proyectos con clave legacy. Nunca uses variables `VITE_` para la clave secreta ni la subas al repositorio.
3. Reinicia o redespliega el backend. Crea una propuesta, apruébala e iníciala desde la aplicación. Reinicia otra vez y confirma que sigue visible en `/api/planning/active` y que `/api/dashboard` refleja sus conteos para los roles autorizados.

El inicio de sesión escribe en la tabla `logins`, incluida en la segunda migración. El backend usa la misma `SUPABASE_SECRET_KEY` para las claves `sb_secret_*` o `SUPABASE_SERVICE_ROLE_KEY` para claves legacy. Las claves secretas nunca deben estar en variables `VITE_` ni en el navegador. Si el registro de login falla, la API responde `503` y no emite una sesión.

## Aplicación y conciliación del esquema

Las migraciones de `supabase/migrations` son la fuente de verdad para nuevos entornos. Revisa el proyecto y su historial antes de ejecutarlas: `supabase link --project-ref <project-ref>`, `supabase migration list` y `supabase db push --dry-run`. Aplica con `supabase db push` solo tras confirmar que el destino es el proyecto correcto y que el plan no altera otros objetos. No uses `supabase db reset --linked` contra un proyecto con datos reales.

Si las tablas `vera_audit_proposals` o `logins` ya se crearon manualmente, primero extrae y compara el esquema remoto con `supabase db pull` en una rama temporal. Las migraciones usan `create table if not exists` y conservan los datos existentes, pero esta instrucción no comprueba que las columnas, restricciones, índices y permisos remotos sean iguales. Resuelve cualquier diferencia antes de aplicar o marcar migraciones como ejecutadas. No uses `migration repair` sin esa comparación. La conexión a Supabase y la ejecución remota siguen pendientes hasta disponer del proyecto del equipo.

## Cuentas persistentes

La tercera migración crea `vera_users` con correo y usuario únicos, hash de contraseña, rol, estado y secretos de 2FA. La tabla tiene RLS habilitado y solo la API con clave de servidor puede accederla. No se insertan cuentas demo ni contraseñas de ejemplo en una base nueva.

Si el proyecto ya contiene `public.users` del VERA anterior, la octava migración copia sus cuentas a `vera_users` conservando los IDs, roles, estados y configuración 2FA. Exige que `vera_users` esté vacía. Conserva los hashes bcrypt existentes; solo transforma dentro de PostgreSQL las contraseñas antiguas que no tenían hash y rechaza una cuenta **activa** en ese estado. No imprime contraseñas ni elimina `public.users`. Comprueba conteos, IDs y referencias a propuestas antes de cambiar `VERA_USER_STORE`; decide por separado cuándo retirar la tabla anterior, una vez confirmado que ningún consumidor la utiliza.

Tras aplicar y verificar la migración, inicializa **una sola vez** un Super Admin desde una terminal confiable con `VERA_USER_STORE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y las variables `VERA_BOOTSTRAP_ADMIN_NAME`, `VERA_BOOTSTRAP_ADMIN_EMAIL`, `VERA_BOOTSTRAP_ADMIN_PASSWORD`. Ejecuta `node backend/scripts/bootstrap-admin.js`; el comando falla si ya existe un Super Admin. No guardes la contraseña de inicialización en Git, Vercel ni en capturas; elimínala del entorno de la terminal tras usarla.

Antes de activar cuentas persistentes junto con planificación persistente, ejecuta `node backend/scripts/check-user-links.js` con la conexión del proyecto. Si informa referencias sin cuenta, concilia responsables y actores históricos antes de activar el modo. Los IDs nuevos comienzan en 1000 para evitar que una cuenta nueva herede accidentalmente la asignación de las cuentas demo con IDs 1 a 6; el script detecta los vínculos pendientes, pero no los corrige automáticamente.

Luego configura `VERA_USER_STORE=supabase` y `VERA_INSTITUTIONAL_DOMAINS` con los dominios reales permitidos en el backend y redespliega. El registro, inicio de sesión, 2FA, roles y cambios de estado consultan la base en cada solicitud. El modo `memory` mantiene las cuentas de ejemplo únicamente para el demo y las pruebas locales. Comprueba en un entorno de prueba que una cuenta pendiente continúa pendiente tras reiniciar, que aprobarla permite entrar, y que deshabilitarla invalida de inmediato una sesión anterior. La suite automatizada usa respuestas simuladas; la persistencia remota debe verificarse aparte con el proyecto del equipo.

## Riesgos y controles persistentes

La cuarta migración crea `vera_risks` y `vera_controls`. Los riesgos conservan sus evaluaciones y los controles sus vínculos a riesgos y evaluaciones de efectividad. Ambos usan versiones para rechazar escrituras concurrentes; un índice único impide repetir un riesgo con el mismo título y área. Las tablas tienen RLS habilitado y solo la API con clave de servidor puede leerlas o modificarlas.

Activa `VERA_RISK_CONTROL_STORE=supabase` **solo después** de activar `VERA_USER_STORE=supabase` y `VERA_PLANNING_STORE=supabase`, aplicar la migración y conciliar las referencias a cuentas. La API rechaza esa combinación incompleta al iniciar. Comprueba en un entorno de prueba que un riesgo, su evaluación y un control asociado conservan los mismos IDs y versiones después de reiniciar el backend; verifica además que un Auditor solo ve los riesgos asignados y sus controles. Las pruebas automatizadas del repositorio simulan la API de Supabase; todavía falta la comprobación contra el proyecto remoto.

## Evidencias y comentarios persistentes

La quinta migración crea `vera_evidence` y `vera_audit_comments` para las referencias de evidencia y los comentarios de auditoría. Ambas tablas tienen RLS habilitado y solo la API con clave de servidor puede accederlas. La API conserva el control de acceso por rol y asignación antes de devolver evidencias o comentarios.

Activa `VERA_EVIDENCE_COMMENT_STORE=supabase` después de activar y comprobar planificación, cuentas, riesgos y controles persistentes. La API rechaza una combinación incompleta. En un entorno de prueba, registra una evidencia vinculada a un riesgo y un comentario en una propuesta; reinicia el backend y comprueba que ambos permanecen con sus IDs originales, que la persona Auditor solo ve los elementos a los que tiene acceso y que no aparecen claves en las respuestas. Esta migración guarda **referencias y metadatos**, no archivos binarios; no implica un bucket de Supabase Storage.

## Bitácora persistente

La sexta migración crea `vera_audit_events` como tabla de solo inserción y lectura para la API. Los triggers registran en la misma transacción cada inserción, actualización o eliminación de cuentas, propuestas, riesgos, controles, evidencias y comentarios, además de cada inserción en `logins`. Esos eventos de origen `DATABASE` confirman que el cambio quedó comprometido; registran tipo de tabla, operación, ID y versión/estado disponible, sin copiar contraseñas, hashes ni secretos 2FA. El actor puede quedar vacío en este nivel porque Supabase recibe la operación con una clave de servidor, no con la identidad del usuario final.

Activa `VERA_AUDIT_STORE=supabase` únicamente después de aplicar todas las migraciones y activar los demás almacenes. Los eventos de origen `APPLICATION` aportan actor, acción de negocio y contexto; si falla su inserción, la acción de negocio conserva su resultado y el backend escribe `[AUDIT_EVENT_WRITE_FAILED]` en los logs. El trigger mantiene la evidencia transaccional de las mutaciones persistidas, pero un evento de autenticación fallida puede carecer de contexto persistente durante una falla de Supabase. El registro de un inicio de sesión exitoso en `logins` sigue siendo obligatorio antes de emitir la sesión.

Comprueba en un entorno de prueba que los eventos del cambio y de la acción aparecen en `/api/audit`, que se pueden filtrar por acción, actor, fecha y entidad, que solo el Super Admin consulta la bitácora, y que continúan disponibles tras reiniciar. Revisa también la fila correspondiente en `vera_audit_events` para confirmar el trigger. Las pruebas automatizadas actuales simulan la API REST y **no ejecutan los triggers PostgreSQL**; esa comprobación exige el proyecto Supabase del equipo.

## Comprobación del entorno conectado

En un entorno de prueba con `VERA_PLANNING_STORE=supabase`, verifica con cuentas de Jefatura, Dirección y Auditor: crea una propuesta, apruébala, iníciala y consulta `/api/planning/active` y `/api/dashboard`. Reinicia el backend y repite las lecturas; el mismo ID y estado deben seguir presentes. Comprueba que el Auditor solo ve sus asignaciones, que la tabla `logins` recibió el acceso y que ninguna respuesta incluye la clave secreta. No uses esta comprobación para escribir datos sintéticos en producción.

Las pruebas automatizadas del repositorio simulan las respuestas de Supabase. Para afirmar que la conexión real pasó, registra el entorno, fecha, commit, IDs observados antes y después del reinicio y resultados, sin copiar tokens ni datos personales al informe.

Sin configuración completa, las solicitudes de planificación responden `503` en modo Supabase; no se sustituyen por datos temporales. No se cargan las tres propuestas de demostración en la base: un proyecto recién configurado comienza vacío.

## Alcance y límites

- Se almacenan título, objetivo, alcance temporal, área, responsable, factores y nivel de riesgo, estado y actor/fecha de cada decisión. Los cambios de estado y las ediciones usan una versión para detectar modificaciones concurrentes; la base impide duplicados por título, área y año.
- La API consulta Supabase en cada solicitud del panel, matriz, planificación y notificaciones. Los permisos por rol y asignación se aplican antes de responder.
- Las cuentas pueden persistirse al activar `VERA_USER_STORE=supabase`; riesgos y controles pueden persistirse juntos con `VERA_RISK_CONTROL_STORE=supabase`; evidencias y comentarios pueden persistirse con `VERA_EVIDENCE_COMMENT_STORE=supabase`; la bitácora general puede persistirse con `VERA_AUDIT_STORE=supabase`. La persistencia integral solo puede declararse tras activar y verificar todos esos modos en el proyecto remoto.
- La matriz principal clasifica el riesgo de cada auditoría con sus factores almacenados. El riesgo residual requiere datos persistentes de controles/evaluaciones y sigue pendiente.
- Este repositorio no contiene credenciales ni acceso a un proyecto Supabase; la migración SQL y la conexión real deben ejecutarse en el proyecto del equipo para cerrar la evidencia de aceptación.
