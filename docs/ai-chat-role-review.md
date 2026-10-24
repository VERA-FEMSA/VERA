# Revisión de solicitudes de rol desde el chat

Una cuenta Super Admin activa puede consultar y decidir solicitudes de cambio de rol desde una conversación guardada. VERA usa la misma operación de revisión del módulo de Usuarios; el modelo de lenguaje no aprueba ni cambia permisos. Las demás cuentas no pueden ver la lista.

1. Escribe `Solicitudes de rol pendientes`. El asistente muestra el ID, la cuenta, el rol actual, el rol solicitado y el motivo de cinco solicitudes por vez. Escribe `Siguientes solicitudes de rol` para continuar; cada página vuelve a consultar el estado vigente.
2. Escribe `Aprueba solicitud de rol #ID` o `Rechaza solicitud de rol #ID`.
3. Verifica en la vista previa la cuenta, los roles, el motivo y el efecto de la decisión. Escribe `Confirmar revisión de rol` dentro de cinco minutos. Otra pregunta descarta la vista previa.
4. VERA registra la decisión y la bitácora. Una aprobación surte efecto en el servidor; la cuenta afectada debe iniciar sesión de nuevo para usar el rol vigente. Un rechazo conserva sus permisos.

El servidor vuelve a comprobar que el Super Admin siga activo, que la solicitud esté pendiente, que la cuenta objetivo siga activa y que su rol no haya cambiado desde la vista previa. La reserva del turno precede a la escritura. La operación de revisión en Supabase es atómica y rechaza una segunda decisión sobre la misma solicitud. Si la respuesta del chat se pierde, consulta las solicitudes y el estado de la cuenta antes de decidir de nuevo. No se añaden permisos a otros roles ni se cambia la tabla de Supabase.

Las pruebas locales cubren aprobación, rechazo, repetición, rol ajeno y cambio entre vista previa y confirmación. No prueban la aceptación autenticada en Production; ver [#226](https://github.com/VERA-GRC-IRM/VERA/issues/226).
