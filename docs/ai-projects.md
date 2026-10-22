# Proyectos privados del asistente

Cada cuenta puede crear, renombrar y eliminar hasta 12 proyectos para agrupar conversaciones. El selector muestra las conversaciones del proyecto elegido o las que siguen sin proyecto. También se puede mover un hilo existente. El nombre y la descripción son metadatos de organización; **no se envían al modelo** ni modifican la autorización de VERA.

La API requiere sesión activa, comprueba la propiedad del proyecto y de cada conversación, y rechaza el recorrido temporal de otro rol. Un rol distinto de la misma cuenta no hereda sus proyectos. La tabla privada tiene RLS y no concede acceso directo a `anon` ni `authenticated`. Una restricción en la base de datos impide vincular un hilo a la carpeta de otra cuenta. Al eliminar un proyecto, las conversaciones y sus mensajes permanecen y vuelven a «Sin proyecto».

## Activación y aceptación

1. Tener activado el historial de conversaciones y aplicar primero `20261022020000_ai_conversations.sql`.
2. Revisar el destino y aplicar `20261022030000_ai_projects.sql`; no usar `db reset`.
3. Activar `VERA_AI_PROJECTS_ENABLED=true` y redesplegar.
4. Con dos cuentas sintéticas, comprobar creación, recarga, movimiento, eliminación sin pérdida de hilos, rechazo de acceso cruzado y conservación tras otro despliegue. La prueba local y los mocks de Supabase no prueban por sí solos el entorno real.

Los proyectos actuales no comparten conversaciones con otras personas y no contienen instrucciones persistentes para el modelo. Compartir proyectos requeriría reglas de permisos específicas y aceptación adicional.
