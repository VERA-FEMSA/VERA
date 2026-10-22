# Historial privado de conversaciones de IA

## Comportamiento

Con `VERA_AI_CONVERSATIONS_ENABLED=true`, cada cuenta puede crear hasta 30 conversaciones, generales o enfocadas en un expediente. Puede continuar, renombrar y eliminar cada una. Se guardan como máximo 40 mensajes por conversación, con respuesta, modo, fuentes mostradas y hora de consulta. La interfaz los recupera al recargar o iniciar sesión en otro dispositivo. No se migran las conversaciones temporales anteriores.

La conversación pertenece a una cuenta y al rol con que fue creada. Las rutas comprueban la identidad en el servidor; una cuenta distinta recibe 404. El recorrido temporal de otra vista de rol no permite abrir conversaciones. Antes de abrir o reutilizar un hilo, el servidor calcula un sello de los IDs de auditorías, riesgos, controles, hallazgos, pendientes y evidencias actualmente visibles. Si cambia ese alcance, oculta los mensajes antiguos y exige iniciar un hilo nuevo. Es una regla conservadora: añadir un expediente visible también puede volver obsoleto el hilo. Las respuestas guardadas son históricas; sus datos y enlaces pueden haber cambiado desde la hora mostrada.

El texto y las fuentes guardadas son datos privados. La tabla tiene RLS, sin permisos de `anon` ni `authenticated`; solo la API con clave de servidor accede y siempre filtra por cuenta y rol. El cliente nunca envía respuestas arbitrarias para guardarlas. El servidor toma las seis intervenciones recientes del historial propio, vuelve a construir el contexto autorizado y guarda el turno solo después de obtener una respuesta válida. Un cambio concurrente se rechaza por versión; una falla de Supabase responde error, sin simular persistencia en memoria.

## Activación

1. Confirmar que el proyecto de destino es el Supabase de VERA y aplicar la migración aditiva `20261022020000_ai_conversations.sql`. No usar `db reset` en el proyecto compartido.
2. Comprobar RLS, permisos y que la tabla está vacía. La migración no transforma cuentas ni evidencias existentes.
3. Activar `VERA_AI_CONVERSATIONS_ENABLED=true` en el despliegue y redesplegar. La bandera queda `false` en el ejemplo y el flujo anterior sigue funcionando hasta entonces.
4. Con cuentas sintéticas de dos roles, comprobar creación, recarga, acceso cruzado 404, renombrado, eliminación, cambio de alcance y persistencia después de un nuevo despliegue. Registrar la evidencia sin incluir preguntas o respuestas privadas.

El historial **no es memoria de preferencias**: no se inserta automáticamente en otras conversaciones ni se usa para entrenar modelos. Tampoco hay todavía proyectos, adjuntos en el chat general ni OCR de PDF escaneado. Esas capacidades requieren incrementos separados y aceptación propia.
