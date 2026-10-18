# Operación de privacidad del entorno de demostración VERA

Versión del aviso: `2026-10-18`. Responsable y canal: Carlos Sánchez Gutiérrez, `carlos.sanchez.gtz.it@gmail.com`. Este procedimiento cubre la operación manual; no afirma que exista una eliminación automática.

## Solicitudes de acceso, rectificación, cancelación u oposición

1. Registrar la fecha de recepción y el identificador de caso en un espacio privado; no publicar documentos de identidad, correo personal ni datos de la solicitud en una issue pública.
2. Confirmar la identidad usando la cuenta y un medio adecuado al riesgo. No pedir contraseñas ni códigos. Antes de entregar datos o cambiar una cuenta, resolver coincidencias ambiguas y solicitudes hechas por representantes.
3. Identificar la fila `vera_users`, su `auth_user_id` si existe, sesiones, datos de demostración asociados y bitácoras. Responder la determinación dentro de los plazos legales aplicables. La regla operativa aprobada es eliminar la cuenta dentro de 30 días posteriores a la validación de la solicitud procedente, o antes si corresponde, salvo bloqueo o conservación legal justificada.
4. Antes de borrar, deshabilitar el acceso y revisar dependencias. `vera_notification_reads` referencia `vera_users`; una eliminación directa puede fallar. Desvincular los registros dependientes conforme al caso y borrar tanto la identidad de Supabase Auth como la cuenta VERA. Revisar sesiones activas y registros vinculados. La bitácora puede conservar nombres de usuario; evaluar minimización, bloqueo o conservación justificada por separado.
5. Registrar la fecha, sistemas revisados, resultado, excepciones y comunicación enviada a la persona. No incluir claves, tokens ni datos sensibles en el registro operativo.

## Revisión de bitácoras cada 90 días

Revisar `vera_audit_events`, `logins`, registros de acceso fallido y cualquier retención de proveedores. Documentar el periodo revisado, necesidad de conservación, acción de supresión o desidentificación y motivo de cualquier excepción. La revisión no equivale a eliminar automáticamente todas las bitácoras cada 90 días.

## Cambios del aviso

Mantener la versión en `backend/config/privacyNotice.js` y `frontend/src/constants/privacyNotice.js` sincronizada con la página `/privacidad`. Un cambio material requiere una nueva versión, revisión del flujo de alta y comunicación según la finalidad modificada. No cambiar solo el texto sin actualizar la versión que se guarda para cuentas nuevas.

Referencia legal: [LFPDPPP vigente, artículos 15, 16, 24 y 27–31](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf).
