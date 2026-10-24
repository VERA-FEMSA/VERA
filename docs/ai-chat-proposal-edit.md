# Edición de propuestas desde el asistente

En una conversación guardada, una cuenta con permiso puede escribir `Edita la propuesta AUD-04: objetivo = «Revisar controles de acceso» porque cambió el alcance acordado.` El chat acepta título, objetivo, alcance, justificación y área de una propuesta abierta. Muestra el valor anterior, el nuevo y el motivo, y exige `Confirmar edición de propuesta` dentro de cinco minutos. Una pregunta distinta descarta la vista previa.

Chat y formulario comparten `proposalService`: la API vuelve a comprobar cuenta activa, rol, autoría de Jefatura, estado abierto, campos requeridos y duplicados. El control de versión en Supabase evita guardar sobre un expediente modificado desde la vista previa. La bitácora registra actor, expediente y motivo del cambio hecho en el chat. Dirección no edita; Jefatura solo sus propias propuestas.

La edición no usa texto generado por Azure como autorización. El chat sin historial, una consulta con adjunto o una conversación de recorrido de rol no pueden realizar cambios. Las pruebas automatizadas cubren la vista previa, confirmación, repetición y denegación por rol/autoría. La ejecución local no demuestra una edición persistida en Supabase Production, que requiere aceptación autenticada separada.
