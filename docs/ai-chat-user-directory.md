# Directorio de cuentas desde el chat

Super Admin y Director pueden consultar cuentas sin salir de una conversación guardada:

```text
Usuarios del sistema
Usuarios con rol Auditor
Busca usuario gerente@vera.local
```

VERA presenta ID, nombre, correo, rol y estado de hasta diez cuentas visibles. `Siguientes usuarios` continúa la lista. La búsqueda exige el correo exacto y devuelve «No hay una cuenta visible» cuando no existe o el rol no puede verla. Director no ve cuentas Super Admin ni registros antiguos pendientes, igual que en el módulo Usuarios. Los demás roles no acceden al directorio. El servidor vuelve a comprobar cuenta y rol en cada turno y usa los datos públicos del repositorio de usuarios, sin incluir contraseñas ni secretos de doble factor.

Esta función sólo consulta. Cambiar roles y estados exige flujos distintos con confirmación y bitácora; el directorio no convierte texto del modelo en autorización. No llama a Azure OpenAI. La aceptación autenticada de la versión final en Production sigue pendiente en [#226](https://github.com/VERA-GRC-IRM/VERA/issues/226).
