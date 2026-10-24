# Solicitudes de rol desde el asistente

Una persona autenticada puede escribir `¿Qué rol tengo?`, `Mis solicitudes de rol` o `Solicita rol gerente porque necesito gestionar riesgos del portafolio`. El asistente explica el rol vigente y el estado de solicitudes, o muestra una vista previa con el rol solicitado y el motivo. El cambio se envía únicamente tras `Confirmar solicitud de rol` en la misma conversación guardada, durante cinco minutos. Otra intervención descarta la vista previa.

La solicitud no concede permisos. Reutiliza la misma validación y el mismo repositorio del formulario **Mi rol**: cuenta activa, rol permitido distinto del actual, motivo de 10 a 500 caracteres y una sola solicitud pendiente. La base de datos conserva su restricción de solicitud pendiente única; el servicio vuelve a verificar el rol antes de crearla y registra el evento `ROLE_CHANGE_REQUESTED`. `SUPER_ADMIN` sigue siendo el único rol que puede revisar solicitudes por la ruta existente; no se ofrece aprobación administrativa desde el chat en este incremento.

La conversación sin historial no puede crear solicitudes. Si el rol o alcance cambia, el hilo anterior deja de ser accesible. Las preguntas enviadas junto con adjuntos o evidencia no se interpretan como órdenes de cambio. La respuesta muestra estado e identificador, sin exponer listas de otras cuentas.

Las pruebas locales cubren vista previa, confirmación, ausencia de cambio de permisos, duplicado, consulta de estado, denegación de `SUPER_ADMIN` y cambio de acceso entre vista previa y confirmación. La prueba local no demuestra entrega de una solicitud en Supabase Production; esa aceptación requiere una cuenta de prueba autorizada y una revisión real.
