# Recorrido de roles para Super Admin

En el menú lateral o en la búsqueda global, **Super Admin** puede elegir Auditor, Jefatura, Gerente o Director. VERA abre el panel con la navegación, las consultas y los datos permitidos para la cuenta de referencia de ese rol. La banda fija identifica el rol activo y permite volver a la sesión de Super Admin.

El recorrido dura hasta 20 minutos y es **solo de lectura**. La API rechaza cualquier operación de escritura con el token de recorrido, aunque alguna pantalla muestre un botón de acción. Las consultas siguen usando las reglas de visibilidad del rol y del usuario de referencia; por ejemplo, Auditor ve sus asignaciones, no el portafolio del administrador. La cuenta de Super Admin no cambia de rol en la base de datos. Si se desactiva al administrador o a la cuenta de referencia, el servidor deja de aceptar el recorrido.

Las cuentas de referencia son las cuentas existentes `auditor`, `jefatura`, `gerente` y `director` en `@vera-digital-systems.com` cuando los usuarios están en Supabase. En desarrollo local se usan sus equivalentes de `@vera.local`. Si falta alguna o tiene un rol distinto, la API devuelve un error; no sustituye silenciosamente a otra persona.

El navegador conserva la sesión original solo para regresar; nunca envía ese token en las consultas del recorrido. Al cerrar sesión se elimina. El recorrido no inicia sesión con la contraseña de la cuenta de referencia y no permite elevar permisos. Para realizar una acción real, vuelve a Super Admin o entra normalmente con la cuenta del rol correspondiente.
