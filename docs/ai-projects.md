# Proyectos privados del asistente

Cada cuenta puede crear, renombrar y eliminar hasta 12 proyectos para agrupar conversaciones. El selector muestra las conversaciones del proyecto elegido o las que siguen sin proyecto. También se puede mover un hilo existente. El nombre y la descripción son metadatos de organización; **no se envían al modelo** ni modifican la autorización de VERA.

Cada proyecto admite hasta 800 caracteres de preferencias opcionales para sus respuestas generales: formato, brevedad o enfoque. La persona puede verlas, corregirlas y eliminarlas en el editor del proyecto. VERA las obtiene del proyecto privado de la conversación, las marca como datos no confiables y no factuales y no las usa como fuente, permiso o hecho de auditoría. No afectan respuestas calculadas, búsquedas de evidencias ni consultas de archivos adjuntos. Si el proyecto se elimina, los hilos se conservan y dejan de recibir esas preferencias.

La API requiere sesión activa, comprueba la propiedad del proyecto y de cada conversación, y rechaza el recorrido temporal de otro rol. Un rol distinto de la misma cuenta no hereda sus proyectos. La tabla privada tiene RLS y no concede acceso directo a `anon` ni `authenticated`. Una restricción en la base de datos impide vincular un hilo a la carpeta de otra cuenta. Al eliminar un proyecto, las conversaciones y sus mensajes permanecen y vuelven a «Sin proyecto».

## Activación y aceptación

1. Tener activado el historial de conversaciones y aplicar primero `20261022020000_ai_conversations.sql`.
2. Revisar el destino y aplicar `20261022030000_ai_projects.sql`; no usar `db reset`.
3. Activar `VERA_AI_PROJECTS_ENABLED=true` y redesplegar.
4. Con dos cuentas sintéticas, comprobar creación, recarga, movimiento, eliminación sin pérdida de hilos, rechazo de acceso cruzado y conservación tras otro despliegue. La prueba local y los mocks de Supabase no prueban por sí solos el entorno real.

Las preferencias requieren aplicar también `20261022060000_ai_project_instructions.sql` antes de publicar el código que lee el campo; la migración solo añade una columna vacía a proyectos existentes. Compartir proyectos requeriría reglas de permisos específicas y aceptación adicional. La prueba local con proveedor simulado no demuestra que el modelo real respete siempre estas preferencias ni que ignore una instrucción maliciosa; la persona debe revisar las respuestas.
