# Registro de acciones de seguimiento

Una acción representa un compromiso humano relacionado con una auditoría, un riesgo, un control o un hallazgo. Es diferente de una notificación derivada: **leída** describe si alguien abrió un aviso; **terminada** es una transición explícita de la acción con una explicación y un actor. La IA no crea ni cierra acciones.

## Contrato y permisos

`/api/actions` exige sesión. `GET /` lista acciones de registros visibles y admite `sourceType` + `sourceId` juntos; `GET /:id` devuelve 404 tanto para un ID ausente como para un registro fuera de alcance. `GET /assignees?sourceType=...&sourceId=...` ofrece solamente cuentas activas que también pueden leer el origen. `POST /` requiere uno de los roles autorizados para crear registros. El título (3–140 caracteres), motivo (10–1,000), responsable activo, fecha objetivo ISO y vínculo al registro son obligatorios.

El Auditor solo puede vincular acciones a auditorías asignadas, riesgos propios, controles de sus riesgos y hallazgos de esos riesgos. Para todos los roles, la API vuelve a comprobar visibilidad del origen en cada lectura, incluso si la asignación o el vínculo del registro cambian después. Dirección conserva lectura sin escritura. El responsable o los roles que dirigen planeación pueden cambiar el estado; solo estos últimos pueden reasignar. Un responsable Auditor debe poder leer también el registro al que se le asigna la acción.

Los estados son `OPEN`, `IN_PROGRESS`, `DONE` y `CANCELLED`. Cada transición y reasignación pide explicación de 10–1,000 caracteres, conserva actor y fecha en `history` y usa `version` para rechazar escrituras sobre una versión anterior (409). No hay borrado de acciones. Los cambios también se registran en la bitácora de la aplicación sin copiar los textos libres al evento.

## Persistencia y activación

En el modo local, el repositorio de acciones usa memoria. Cuando `VERA_EVIDENCE_COMMENT_STORE=supabase`, usa la tabla privada `vera_actions` y la misma conexión de servidor que los demás registros GRC. Aplica primero la migración `20261022010000_create_actions.sql` al proyecto correcto, tras revisar el historial y un plan en seco. La tabla conserva el documento y una versión para concurrencia, restringe los campos de referencia y tiene RLS sin acceso directo para `anon` ni `authenticated`. El trigger añade evidencia de cambios a la bitácora de base de datos. La API valida los vínculos entre tipos de entidad; la base no puede usar una sola clave foránea para cuatro tablas diferentes.

Si el proyecto remoto carece de la tabla, las rutas nuevas fallan como error de almacenamiento en vez de simular éxito con memoria. Este incremento no activa correo, push ni decisiones automáticas. Antes de darlo por aceptado en producción, comprobar con cuentas reales cada rol, una creación, una transición, una reasignación, rechazo de acceso ajeno, concurrencia y lectura tras reiniciar.

## Bandeja de Pendientes

La sección **Acciones registradas** de Pendientes separa compromisos persistentes de avisos derivados de propuestas y auditorías. Por defecto muestra acciones abiertas asignadas a la cuenta; permite consultar las demás acciones visibles y las finalizadas. Los indicadores cuentan asignadas, vencidas y abiertas visibles, sin mezclarse con el número de avisos sin leer. La creación usa un selector de registros accesibles (`GET /api/actions/sources`) y ofrece responsables autorizados para ese registro. Dirección puede consultar, sin botones de escritura. Un cambio de estado o responsable exige explicación y se guarda con control de versión; un conflicto 409 requiere actualizar la bandeja antes de reintentar.

## Ficha para comité

`GET /api/actions/for-audit/:auditId` reutiliza el expediente autorizado para reunir acciones vinculadas a la auditoría y a sus riesgos, controles y hallazgos visibles. La ficha impresa muestra el compromiso, origen, responsable, estado y fecha objetivo, con conteos de abiertas, vencidas y terminadas. Si falla la lectura de acciones, la ficha conserva el expediente y presenta los conteos como no disponibles en vez de simular cero. El enlace de alta desde la ficha abre Pendientes con la auditoría preseleccionada; no modifica nada dentro del documento de solo lectura.
El indicador «vencida» compara la fecha objetivo con el día local del navegador; la fecha queda almacenada como día de calendario, sin zona horaria implícita.
