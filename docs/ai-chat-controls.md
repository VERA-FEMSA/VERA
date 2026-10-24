# Evaluación de controles desde la conversación

Una cuenta `GERENTE` o `SUPER_ADMIN` puede evaluar un control existente desde una conversación guardada. Por ejemplo:

`Evalúa el control «Conciliación mensual» con efectividad 2 porque la evidencia del trimestre mostró varias excepciones.`

También se acepta un ID `CTL-…`. La vista previa muestra el registro, calificación de 1 a 5, resultado efectivo o inefectivo y justificación. `Confirmar control` en el siguiente mensaje, dentro de cinco minutos, ejecuta la evaluación. Otra pregunta cancela la vista previa. El chat sin historial sólo orienta y no modifica registros.

La ruta HTTP y el asistente usan el mismo `controlEvaluationService`. Se comprueban cuenta activa, rol, calificación, justificación de 10 a 500 caracteres, versión y número de evaluaciones. El repositorio añade la evaluación con responsable y fecha; la bitácora registra `CONTROL_EVALUATED`. Si el resultado es inefectivo, el asistente indica que puede existir un hallazgo, pero no lo crea automáticamente: el registro de un hallazgo requiere su propia autorización, relación con riesgo y confirmación.

El texto generado por Azure y los documentos adjuntos no ejecutan evaluaciones. La prueba reproducible está en `backend/tests/assistantControlEvaluation.test.js`; la aceptación autenticada en Production continúa pendiente en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128).
