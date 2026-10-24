# Edición controlada de auditorías desde el chat

Gerente y Super Admin pueden editar una auditoría aprobada o en curso en una conversación guardada. Por ejemplo:

```text
Edita la auditoría AUD-01: objetivo = «Revisar también los pagos» porque se amplió el alcance aprobado.
```

La instrucción exige ID exacto, un campo, valor entre `« »` y motivo de 10 a 300 caracteres. Los campos siguen [las reglas vigentes por estado](../backend/config/auditEditRules.js): en `APPROVED`, objetivo, responsable, trimestre, fecha de inicio, fecha de fin, probabilidad e impacto; en `ACTIVE`, objetivo, responsable y fecha de fin. El responsable se indica mediante el ID numérico de una cuenta Auditor activa; el servidor muestra su nombre en la vista previa. Las fechas usan `AAAA-MM-DD`, el trimestre `Q1`–`Q4` y probabilidad e impacto van de 1 a 3.

VERA enseña valor anterior, valor nuevo, estado y motivo. `Confirmar edición de auditoría` registra el cambio en cinco minutos; otra pregunta descarta la vista previa. El chat y el formulario comparten `auditEditService`, que vuelve a comprobar cuenta activa, rol, estado y versión de la auditoría, aplica las reglas completas de la propuesta y escribe el detalle en la bitácora. El modelo no tiene acceso directo para guardar. La confirmación usa una reserva y un identificador de operación para reconocer reintentos sin duplicar el cambio.

No se cambian desde este flujo títulos, áreas ni el estado. Aprobación, inicio y cierre siguen sus comandos específicos. La aceptación autenticada en Production tras desplegar el SHA final permanece pendiente en [#226](https://github.com/VERA-GRC-IRM/VERA/issues/226).
