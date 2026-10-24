# Compromisos desde la conversación

La conversación guardada permite consultar, crear y cambiar compromisos sin salir del chat. El usuario puede escribir `Muéstrame mis compromisos`, `Muéstrame mis compromisos cerrados` o `Muéstrame mis compromisos cancelados`, escoger el título o identificador mostrado y pedir, por ejemplo:

> Completa el compromiso «Revisar evidencia» porque la revisión quedó documentada.

El asistente **no ejecuta el cambio al recibir esa petición**. Muestra el origen, título y motivo. Sólo la instrucción escrita `Confirmar cambio`, enviada dentro de cinco minutos como siguiente mensaje, ejecuta la transición. Otra pregunta descarta la vista previa.

También se admiten `Inicia el compromiso … porque …`, `Cancela el compromiso … porque …` y `Reabre el compromiso … porque …`. La transición debe estar permitida por las reglas actuales: un compromiso cerrado o cancelado puede reabrirse, pero no se salta directamente a otro estado.

Para consultar quién puede recibir un compromiso, escribe `Lista responsables para el compromiso ACT-…`. Quien tenga permiso de planeación puede pedir `Reasigna el compromiso ACT-… a Jefatura Demo porque cambió la responsabilidad.` La persona se busca por nombre exacto o ID, debe estar activa y tener acceso al origen. También se exige vista previa y `Confirmar cambio`.

Para crear uno a cargo de la propia cuenta, escribe `Crea un compromiso «Revisar evidencia» para el riesgo «Proveedor crítico» porque falta comprobar el control con vencimiento 2026-12-01`. También admite orígenes de auditoría, control y hallazgo visibles. El asistente muestra título, origen, motivo y fecha antes de aceptar `Confirmar cambio`. Si hay varios registros con el mismo nombre, solicita el identificador exacto. La creación de acciones para otra persona se realiza después mediante la reasignación autorizada.

## Reglas aplicadas

- El servidor selecciona el compromiso entre los registros visibles para la cuenta. Si el título no es único, pide el identificador; nunca elige un registro por parecido.
- La operación usa `actionService.changeStatus`, con los mismos permisos de rol y responsable, transición válida, versión optimista y registro de bitácora del módulo Acciones.
- La reasignación usa `actionService.reassign` y comprueba explícitamente en el servidor el permiso de planeación antes de proponer y antes de ejecutar; el servicio vuelve a validar persona, origen y versión.
- La creación usa `actionService.createAction` con las mismas validaciones de origen visible, rol, responsable activo, longitud y fecha que la interfaz. Antes de escribir, reserva la operación en el historial privado con control de versión. Mientras la reserva está en curso, la conversación rechaza nuevas instrucciones; `Confirmar cambio` puede comprobar el resultado sin registrar otro compromiso. Si no hay constancia tras dos minutos, pide una vista previa nueva.
- El borrador y la confirmación viven en una conversación privada vinculada al usuario, su rol y el alcance del expediente. El recorrido de roles no permite conversaciones privadas.
- El asistente comprueba que la cuenta siga activa antes de ejecutar. Si el compromiso cambió desde la vista previa, detiene la operación y pide revisarla de nuevo.
- La conversación sin historial ofrece orientación, pero jamás ejecuta una acción. Archivos adjuntos y texto devuelto por el modelo tampoco pueden disparar una operación.
- Esta función no llama a Azure para interpretar comandos: usa una gramática acotada de la instrucción explícita del usuario. Por eso no consume tokens ni depende de una respuesta generada para escribir.

## Límites

Este incremento cubre la creación de compromisos propios y las transiciones permitidas entre `OPEN`, `IN_PROGRESS`, `DONE` y `CANCELLED`. No crea auditorías, riesgos, controles ni evidencias por chat y no convierte al asistente en un agente autónomo. Las demás acciones requieren diseño y pruebas de autorización independientes. Si la bitácora de conversación falla después de confirmar, el chat informa el resultado y pide recargar la conversación antes de continuar; una reserva incompleta requiere una vista previa nueva.

La suite `backend/tests/assistantActions.test.js` cubre vista previa sin escritura, permiso del responsable, aislamiento entre conversaciones, confirmación única, versión obsoleta y ausencia de escritura en el chat sin historial. CI y mocks no sustituyen la aceptación autenticada en Production descrita en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128).
