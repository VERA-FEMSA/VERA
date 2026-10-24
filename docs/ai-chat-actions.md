# Cambios de compromisos desde la conversación

La conversación guardada permite consultar compromisos abiertos y completar uno sin salir del chat. El usuario puede escribir `Muéstrame mis compromisos`, escoger el título o identificador mostrado y pedir, por ejemplo:

> Completa el compromiso «Revisar evidencia» porque la revisión quedó documentada.

El asistente **no ejecuta el cambio al recibir esa petición**. Muestra el origen, título y motivo. Sólo la instrucción escrita `Confirmar cambio`, enviada dentro de cinco minutos como siguiente mensaje, ejecuta la transición. Otra pregunta descarta la vista previa.

## Reglas aplicadas

- El servidor selecciona el compromiso entre los registros visibles para la cuenta. Si el título no es único, pide el identificador; nunca elige un registro por parecido.
- La operación usa `actionService.changeStatus`, con los mismos permisos de rol y responsable, transición válida, versión optimista y registro de bitácora del módulo Acciones.
- El borrador y la confirmación viven en una conversación privada vinculada al usuario, su rol y el alcance del expediente. El recorrido de roles no permite conversaciones privadas.
- El asistente comprueba que la cuenta siga activa antes de ejecutar. Si el compromiso cambió desde la vista previa, detiene la operación y pide revisarla de nuevo.
- La conversación sin historial ofrece orientación, pero jamás ejecuta una acción. Archivos adjuntos y texto devuelto por el modelo tampoco pueden disparar una operación.
- Esta función no llama a Azure para interpretar comandos: usa una gramática acotada de la instrucción explícita del usuario. Por eso no consume tokens ni depende de una respuesta generada para escribir.

## Límites

Este incremento cubre la transición de un compromiso abierto o en curso a `DONE`. No crea auditorías, riesgos, controles ni evidencias por chat y no convierte al asistente en un agente autónomo. Las demás acciones requieren diseño y pruebas de autorización independientes. Si la bitácora de conversación falla después de confirmar, la versión del compromiso impide repetir la transición; el usuario debe comprobar el estado y el historial del compromiso.

La suite `backend/tests/assistantActions.test.js` cubre vista previa sin escritura, permiso del responsable, aislamiento entre conversaciones, confirmación única, versión obsoleta y ausencia de escritura en el chat sin historial. CI y mocks no sustituyen la aceptación autenticada en Production descrita en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128).
