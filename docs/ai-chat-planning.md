# Decisiones de planificación desde la conversación

Una cuenta `GERENTE` o `SUPER_ADMIN` puede pedir una transición del flujo de gobierno en una conversación guardada:

- `Aprueba la propuesta «Auditoría de accesos» para Q4 porque cumple los criterios de planeación.`
- `Rechaza la propuesta «Auditoría de accesos» porque el alcance está incompleto.`
- `Inicia la auditoría «Auditoría de accesos» porque comenzó el periodo.`
- `Cierra la auditoría «Auditoría de accesos» porque terminó la revisión.`

Se acepta el identificador `AUD-…` en lugar del título. Si éste no es único, VERA pide el ID. El chat muestra el registro, trimestre cuando aplica y motivo. La operación se realiza sólo si el siguiente mensaje es `Confirmar cambio` dentro de cinco minutos. Otra pregunta descarta la vista previa.

`planningTransitionService` reúne las reglas utilizadas tanto por las rutas de Planificación como por el chat. Valida el rol, estado, trimestre, motivo y versión del expediente; utiliza el repositorio existente y registra actor, fecha y decisión en la bitácora. La conversación comprueba otra vez que la cuenta siga activa. Tras una transición legítima, actualiza el alcance privado del historial para que el mismo hilo pueda continuar con los datos vigentes. El chat sin historial no ejecuta cambios; tampoco los disparan documentos adjuntos ni texto generado por Azure.

La función no crea ni edita propuestas, ni cambia campos de una auditoría: esas operaciones requieren su propio contrato de campos, permisos y pruebas. El parser es una gramática explícita; VERA no interpreta libremente órdenes ambiguas como autorización para escribir. Las pruebas están en `backend/tests/assistantPlanning.test.js` y en las suites existentes de Planificación. La aceptación autenticada en Production sigue pendiente en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128).
