# Estado de cuentas desde el chat

Una cuenta Super Admin activa puede habilitar o deshabilitar otra cuenta sin abrir el módulo Usuarios. Primero puede consultar `Usuarios del sistema` o buscar un correo exacto para conocer su ID. Después escribe:

```text
Deshabilita cuenta #5
Confirmar cambio de cuenta
```

También se admite `Habilita cuenta #5`. La primera orden sólo prepara una vista previa con ID, nombre, correo, rol y estado. La confirmación debe ser el mensaje siguiente y llega antes de cinco minutos. Otra pregunta descarta la vista previa.

El servidor comprueba otra vez el rol del actor, el estado y la versión de la cuenta objetivo antes del cambio. No permite modificar la cuenta propia, una cuenta antigua pendiente ni una cuenta que haya cambiado tras la vista previa. El mismo servicio controla la ruta de Usuarios y el chat. El cambio se registra en la bitácora. Un reintento después de una reserva no repite automáticamente la mutación: hay que consultar el directorio y preparar otra vista previa.

Director y demás roles no pueden cambiar cuentas. Ningún texto generado por Azure OpenAI autoriza esta acción. La operación conserva el módulo Usuarios; la aceptación autenticada de la versión final en Production sigue pendiente en [#226](https://github.com/VERA-GRC-IRM/VERA/issues/226).
