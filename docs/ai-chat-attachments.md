# Archivos privados del chat

Cada conversación admite dos archivos de hasta 2 MB, y cada cuenta hasta 20 en total. VERA acepta PDF, DOCX, TXT, CSV, PNG, JPEG y WebP. El archivo original se guarda en el bucket privado `vera-evidence` bajo una ruta separada para IA. La API verifica sesión, cuenta, rol y propiedad del hilo antes de cargar, listar, consultar, descargar o quitar un adjunto; solo entrega un enlace de descarga de 60 segundos. La tabla `vera_ai_attachments` tiene RLS y no concede acceso directo a `anon` ni `authenticated`. Un disparador comprueba que el adjunto y la conversación tengan el mismo propietario.

En los documentos, VERA extrae como máximo 30 páginas y 40 000 caracteres, selecciona hasta cinco fragmentos relacionados con la pregunta y exige que la respuesta cite un fragmento. Si la lectura es parcial, lo indica; rechaza totales globales a partir de fragmentos. Un PDF escaneado sin texto se informa como tal. Las imágenes se envían al modelo de Azure con visión **solo cuando se consulta ese archivo**; la respuesta cita la imagen únicamente si el modelo afirma que está sustentada por contenido visible. VERA no identifica personas ni inventa datos externos. Hay que confirmar la interpretación visual en el original.

La consulta de un archivo se mantiene separada de la consulta del portafolio. Seleccionar un adjunto no añade su contenido a otras preguntas o conversaciones. Al borrar el archivo o la conversación, la API intenta eliminar el objeto privado; si el almacén falla, devuelve error para no fingir la eliminación. Las respuestas antiguas siguen siendo históricas y pueden conservar una cita a un archivo ya retirado.

## Activación

1. Verificar el proyecto Supabase VERA y el bucket privado; aplicar antes las migraciones de conversaciones, proyectos y memoria, luego `20261022050000_ai_attachments.sql`.
2. Confirmar que `VERA_EVIDENCE_COMMENT_STORE=supabase` y Azure OpenAI admite visión para imágenes.
3. Activar `VERA_AI_ATTACHMENTS_ENABLED=true` en Vercel y redesplegar. Mantener la bandera apagada si falta Storage o la migración.
4. Probar con dos cuentas reales: aislamiento, tipos inválidos, límites, descarga firmada, preguntas con cita y sin cita, PDF escaneado, imagen, borrado, recarga y persistencia tras despliegue. No afirmar esta aceptación con mocks.

La bandera solo controla el acceso a esta función. Si se apaga tras recibir archivos, no borrar conversaciones hasta reactivarla o ejecutar la limpieza de archivos pendientes, para evitar objetos huérfanos.
