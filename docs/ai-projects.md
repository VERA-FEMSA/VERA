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

## Biblioteca privada del proyecto

Un proyecto puede contener hasta cuatro archivos de 2 MB cada uno. Se conserva el límite de veinte archivos por cuenta, sumando los archivos de proyectos y conversaciones. Cada archivo permanece privado para la cuenta y el rol que lo cargó. Un chat del proyecto puede seleccionar uno de esos archivos al preguntar; elegirlo es explícito y el contenido no se envía a Azure mientras solo se navega por el proyecto. Un chat de otro proyecto no puede consultarlo. El archivo original se guarda en el bucket privado `vera-evidence`; la descarga requiere una URL firmada de corta duración.

Al eliminar el proyecto, sus archivos originales y metadatos se eliminan. Las conversaciones se conservan sin proyecto, pero sus respuestas anteriores pueden citar archivos que ya no están disponibles. No se comparten proyectos entre cuentas y los archivos no constituyen conocimiento global del asistente.

Para activar esta función, aplicar `20261023010000_ai_project_files.sql` después de las migraciones anteriores de proyectos y adjuntos; comprobar el bucket y `VERA_EVIDENCE_COMMENT_STORE=supabase`, y entonces activar `VERA_AI_PROJECT_FILES_ENABLED=true` junto con las banderas de historial, proyectos y adjuntos. No apagar la bandera con archivos existentes antes de revisar su limpieza. La prueba de aceptación debe usar dos cuentas reales y verificar aislamiento, límites, cargas simultáneas, consulta, recarga, borrado y descarga tras otro despliegue.

### Preguntas sobre la biblioteca

Con `VERA_AI_PROJECT_KNOWLEDGE_ENABLED=true`, el selector ofrece «Biblioteca del proyecto» cuando hay texto legible. Esta opción es voluntaria: la pregunta toma como máximo cinco fragmentos relacionados con las palabras de la consulta, de entre los archivos privados del proyecto actual. El contexto enviado a Azure contiene solo esos fragmentos, sus nombres y las referencias necesarias para citar; no se envían todos los archivos ni los de otros proyectos. Las imágenes se consultan una por una con visión; no entran en esta búsqueda textual. Un PDF escaneado sin texto queda fuera hasta que exista OCR.

La respuesta requiere al menos una cita válida. La interfaz señala cuando la lectura fue parcial, y las preguntas que piden totales o una descripción exhaustiva se rechazan porque la muestra no permite esas conclusiones. No se usan embeddings ni se garantiza encontrar sinónimos. Antes de activar la bandera en Production se deben comprobar con dos cuentas reales los permisos, las citas, los casos sin coincidencia y el comportamiento del modelo Azure; los mocks locales no sustituyen esa aceptación.

Los PDF escaneados de la biblioteca pueden extraerse por acción explícita, con límite de dos páginas y verificación del original, cuando se active la bandera de OCR descrita en [Archivos privados del chat](ai-chat-attachments.md).
