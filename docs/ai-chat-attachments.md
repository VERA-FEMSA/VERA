# Archivos privados del chat

La base de datos serializa cargas simultáneas de una cuenta y aplica los límites de dos archivos por conversación y veinte por cuenta; la API comprueba los mismos límites antes de cargar.

Cada conversación admite dos archivos de hasta 2 MB, y cada cuenta hasta 20 en total. VERA acepta PDF, DOCX, TXT, CSV, PNG, JPEG y WebP. El archivo original se guarda en el bucket privado `vera-evidence` bajo una ruta separada para IA. La API verifica sesión, cuenta, rol y propiedad del hilo antes de cargar, listar, consultar, descargar o quitar un adjunto; solo entrega un enlace de descarga de 60 segundos. La tabla `vera_ai_attachments` tiene RLS y no concede acceso directo a `anon` ni `authenticated`. Un disparador comprueba que el adjunto y la conversación tengan el mismo propietario.

En los documentos, VERA extrae como máximo 30 páginas y 40 000 caracteres, selecciona hasta cinco fragmentos relacionados con la pregunta y exige que la respuesta cite un fragmento. Si la lectura es parcial, lo indica; rechaza totales globales a partir de fragmentos. Un PDF escaneado sin texto se informa como tal. Las imágenes se envían al modelo de Azure con visión **solo cuando se consulta ese archivo**; la respuesta cita la imagen únicamente si el modelo afirma que está sustentada por contenido visible. VERA no identifica personas ni inventa datos externos. Hay que confirmar la interpretación visual en el original.

La consulta de un archivo se mantiene separada de la consulta del portafolio. Seleccionar un adjunto no añade su contenido a otras preguntas o conversaciones. Al borrar el archivo o la conversación, la API intenta eliminar el objeto privado; si el almacén falla, devuelve error para no fingir la eliminación. Las respuestas antiguas siguen siendo históricas y pueden conservar una cita a un archivo ya retirado.

## Activación

1. Verificar el proyecto Supabase VERA y el bucket privado; aplicar antes las migraciones de conversaciones, proyectos y memoria, luego `20261022050000_ai_attachments.sql`.
2. Confirmar que `VERA_EVIDENCE_COMMENT_STORE=supabase` y Azure OpenAI admite visión para imágenes.
3. Activar `VERA_AI_ATTACHMENTS_ENABLED=true` en Vercel y redesplegar. Mantener la bandera apagada si falta Storage o la migración.
4. Probar con dos cuentas reales: aislamiento, tipos inválidos, límites, descarga firmada, preguntas con cita y sin cita, PDF escaneado, imagen, borrado, recarga y persistencia tras despliegue. No afirmar esta aceptación con mocks.

La bandera solo controla el acceso a esta función. Si se apaga tras recibir archivos, no borrar conversaciones hasta reactivarla o ejecutar la limpieza de archivos pendientes, para evitar objetos huérfanos.

Los proyectos pueden tener una biblioteca privada independiente. Su cuota de cuatro archivos por proyecto comparte el límite de veinte por cuenta. El archivo del proyecto solo puede consultarse desde un chat de ese mismo proyecto y siempre se elige explícitamente. Véase [Proyectos privados del asistente](ai-projects.md).

## PDF escaneado: OCR explícito

Si un PDF privado no contiene texto seleccionable, la persona puede pedir «Extraer texto del PDF» de forma explícita cuando `VERA_AI_PDF_OCR_ENABLED=true`. La API vuelve a comprobar sesión, propietario, rol y contenedor del archivo; descarga el original del bucket privado y recorta una copia temporal a **las dos primeras páginas** antes de enviarla al recurso Azure OpenAI mediante Responses API. El archivo completo no se transmite al modelo y la carga inicial no ejecuta OCR. La operación admite dos solicitudes por cuenta cada 15 minutos; puede generar consumo de tokens. VERA conserva únicamente texto acotado en la tabla privada y nunca publica el PDF ni el texto en logs. Si el OCR tiene éxito, la persona puede preguntar por sus fragmentos con las reglas de cita existentes; la transcripción puede ser incorrecta y debe contrastarse con el original. Un PDF de más de dos páginas se marca como lectura parcial.

Aplicar `20261023020000_ai_pdf_ocr.sql` después de la migración de archivos de proyecto, confirmar que el despliegue Azure admite PDF en Responses API y que Storage privado funciona, y entonces activar la bandera y redesplegar. Mantenerla apagada ante un error del proveedor. Las pruebas simuladas no acreditan precisión de OCR ni compatibilidad de la instancia Azure real. [Microsoft documenta el envío privado de PDF por Base64 y advierte que texto e imágenes de cada página consumen contexto](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses).
