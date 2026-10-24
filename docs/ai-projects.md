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

Con `VERA_AI_PROJECT_KNOWLEDGE_ENABLED=true`, el selector ofrece «Biblioteca del proyecto» cuando hay texto legible. Esta opción es voluntaria: la pregunta toma como máximo cinco fragmentos relacionados con las palabras de la consulta, de entre los archivos privados del proyecto actual. El contexto enviado a Azure contiene solo esos fragmentos, sus nombres y las referencias necesarias para citar; no se envían todos los archivos ni los de otros proyectos. Las imágenes se consultan una por una con visión; no entran en esta búsqueda textual. Un PDF escaneado sin texto queda fuera hasta que la persona solicita OCR explícito y se indexa el texto acotado.

La respuesta requiere al menos una cita válida. La interfaz señala cuando la lectura fue parcial, y las preguntas que piden totales o una descripción exhaustiva se rechazan porque la muestra no permite esas conclusiones. La búsqueda básica usa palabras; la opción semántica de abajo amplía la recuperación solo para archivos preparados, sin garantizar que encuentre todos los sinónimos. La aceptación de Production con una cuenta demo y un documento sintético comprueba OCR y respuesta puntual; siguen pendientes las pruebas con dos cuentas, los casos sin coincidencia y la evaluación de respuestas del modelo con más documentos. Los mocks locales no sustituyen esa aceptación.

Los PDF escaneados de la biblioteca pueden extraerse por acción explícita, con límite de dos páginas y verificación del original, cuando se active la bandera de OCR descrita en [Archivos privados del chat](ai-chat-attachments.md).

### Búsqueda por significado, opcional

La biblioteca puede complementar las coincidencias de texto con embeddings de Azure `text-embedding-3-small` de 512 dimensiones. **Mejorar búsqueda** prepara un archivo de texto del proyecto mediante una acción explícita; no se indexan archivos de otras cuentas, imágenes sin texto ni archivos solo por abrir la pantalla. El botón informa cuando el archivo ya está preparado. Se conserva el límite de cuatro archivos y 50 fragmentos por archivo. Al consultar la biblioteca, VERA combina hasta tres coincidencias léxicas con fragmentos semánticos suficientemente cercanos y envía al modelo un máximo de cinco fragmentos. Cada respuesta sigue exigiendo una cita al fragmento autorizado; la similitud no acredita que la interpretación de Azure sea correcta.

El índice vectorial está en una tabla privada con RLS, acceso exclusivo de `service_role` y borrado en cascada al eliminar el archivo. La función de búsqueda cruza cada vector con la cuenta, el rol y el proyecto actuales dentro de SQL. El servidor vuelve a cotejar los IDs y posiciones de fragmento con los archivos que acaba de cargar para esa sesión. Si el índice o Azure falla durante una pregunta, la búsqueda de palabras sigue disponible y el resultado señala la reducción de alcance. Si falla la preparación del archivo, se muestra el error; no se marca como preparado.

Para activarlo: desplegar primero la migración aditiva `20261023030000_ai_project_semantic_index.sql` y verificar la extensión `vector`; desplegar en el recurso Azure existente un modelo de embeddings compatible; poner `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` y `VERA_AI_SEMANTIC_ENABLED=true` **solo en el backend**; luego redesplegar. Nunca poner `AZURE_OPENAI_API_KEY` en `VITE_*`. Las operaciones de preparación y pregunta consumen tokens de Azure y tienen límites independientes. Las cuentas existentes y sus archivos no cambian: cada propietario elige cuáles preparar. Confirmar en Production con dos cuentas sintéticas que el índice no cruza roles ni proyectos, que un sinónimo recupera un fragmento que no contiene la palabra exacta, y que una respuesta sin cita válida se rechaza. Las pruebas locales no sustituyen esta aceptación.
