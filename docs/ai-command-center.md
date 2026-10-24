# Operar VERA desde la conversación

El asistente es una entrada alternativa a los módulos existentes. Este incremento permite pedir listas de auditorías, propuestas, riesgos, controles, hallazgos y pendientes, leer los primeros diez resultados en la conversación y continuar escribiendo «siguientes». Cada tarjeta muestra los campos breves disponibles y conserva un enlace al expediente.

## Alcance de este incremento

- La detección de listas es determinista: comprende solicitudes explícitas como «Muéstrame los riesgos altos» o «¿Cuáles son las auditorías activas?». Las preguntas analíticas continúan por el flujo de respuestas de Azure OpenAI.
- El servidor consulta los repositorios en el momento de cada turno y filtra por cuenta y rol antes de construir la página. La continuación vuelve a calcular el alcance; un número de página o filtro anterior no concede acceso.
- La respuesta de lista no llama al modelo ni genera costo de tokens. Muestra cuántos resultados hay en el alcance visible y cuántos aparecen en la página actual.
- «Pendientes» usa las mismas alertas de propuestas y compromisos del módulo de Notificaciones. Si el almacén de compromisos falla, la respuesta advierte que la lista puede estar incompleta y omite el indicador ejecutivo de pendientes hasta recuperar la consulta.
- Este cambio solo lee. Crear, editar, aprobar, rechazar, cerrar o borrar desde el chat requieren un catálogo de operaciones autorizado en el servidor, vista previa y confirmación explícita antes de utilizar las mismas reglas de negocio que la interfaz. Una respuesta libre del modelo nunca es autorización para escribir.

## Verificación y límites

Las pruebas cubren clasificación de solicitudes, paginación, rechazo de una continuación manipulada y exclusión de riesgos ajenos a un auditor. El estado de Production autenticada se registra por separado en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128); un resultado local no acredita esa aceptación.

La conversación evita navegar para consultar un resumen, pero los expedientes siguen disponibles en sus módulos para revisar el original y usar funciones que todavía no están conectadas al asistente. No se eliminaron botones ni rutas existentes.
