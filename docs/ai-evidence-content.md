# Consulta del contenido de evidencias con IA

## Experiencia

En **Evidencias**, cada archivo privado PDF, DOCX, TXT, CSV, PNG, JPEG o WebP ofrece **Consultar contenido con IA**. El usuario pregunta por ese archivo concreto. VERA muestra la respuesta, la hora de consulta, la cobertura de fragmentos y los pasajes citados; en PDF, también la página. El enlace de cada cita vuelve a la tarjeta de evidencia, desde donde se puede abrir el archivo original mediante la descarga firmada existente.

Para una imagen, la extracción de texto es una acción opcional y explícita. Antes del clic, la interfaz avisa que VERA enviará la imagen privada al recurso Azure OpenAI configurado. La carga del archivo por sí sola no llama al modelo; una vez extraído el texto, se pueden hacer preguntas sobre sus fragmentos. Los PDF escaneados sin capa de texto siguen sin OCR de páginas. Las referencias externas de Drive u otros sistemas tampoco se descargan ni se indexan.

## Flujo de datos y permisos

1. La carga conserva el archivo en el bucket privado `vera-evidence`. Para PDF/DOCX/TXT/CSV, el backend extrae texto y lo divide en fragmentos de hasta 800 caracteres que guarda en `vera_evidence_text_chunks` mediante la clave de servidor. En CSV, los fragmentos conservan el encabezado y el número de fila; no se ejecutan fórmulas. El archivo original no se copia a la tabla.
2. Si un archivo previo aún no tiene fragmentos, la primera consulta lo lee desde Storage con la clave de servidor e intenta indexarlo. Esto evita una migración masiva del contenido histórico.
3. `POST /api/evidence/:id/ask` comprueba JWT, existencia del archivo y permiso de lectura sobre el riesgo, control o auditoría vinculados **antes** de leer fragmentos o llamar a Azure. Una evidencia ajena responde 404 sin revelar título ni contenido.
4. La consulta selecciona hasta cinco fragmentos relacionados con los términos de la pregunta. Si no hay texto o coincidencias, responde sin llamar a Azure. Solo esos fragmentos, la pregunta y el rol se envían al despliegue Azure de VERA. No se envían otros archivos ni el portafolio completo.
5. La respuesta generada solo se presenta si cita al menos un fragmento del conjunto permitido. La API devuelve el pasaje exacto y su página. Un ID de cita permitido no verifica automáticamente que la interpretación del modelo sea correcta: el usuario debe revisar el archivo original.
   Si la pregunta pide un total, porcentaje, promedio o una lista de **todo** el archivo, VERA no llama al modelo: el índice tiene límites y no acredita que representa el original completo. Se solicita una pregunta sobre una fila, página o sección concreta. Esta detección por palabras es conservadora; puede detener alguna consulta puntual y no sustituye una verificación humana del alcance.
6. `POST /api/evidence/:id/index-image` comprueba sesión, permiso de creación, existencia y visibilidad de la entidad antes de descargar la imagen. Descarga desde el bucket privado, confirma firma y límite de 3 MB, envía únicamente esa imagen a Azure OpenAI y guarda hasta 6 000 caracteres de texto OCR en la misma tabla privada de fragmentos. Si ya hay fragmentos, devuelve el índice existente sin otra llamada al modelo. El rol Director puede consultar una imagen ya indexada, pero no iniciar la extracción.

El índice usa la tabla Supabase existente como almacén de fragmentos, sin contratar Azure AI Search. La clave de servicio queda solo en el servidor. La tabla tiene RLS habilitado, no concede acceso a `anon` ni `authenticated` y está ligada a `vera_evidence` por clave foránea. La API aplica RBAC antes de consultar el índice. El rate limit de preguntas es de diez por usuario cada 15 minutos y las respuestas llevan `Cache-Control: no-store`; la telemetría registra rol, modo, duración y tokens, no preguntas ni pasajes.

## Límites explícitos

- Se extraen como máximo **30 páginas de PDF** y **40 000 caracteres** por archivo. Para DOCX se analiza el texto principal de `word/document.xml` (hasta 200 partes ZIP y 2 MB de XML); no se leen encabezados, pies, notas, imágenes ni objetos incrustados. Para CSV se leen hasta **1 000 filas** y 50 columnas, con UTF-8, encabezados y ancho consistente. El contenido adicional no se indexa. Cada respuesta utiliza hasta cinco fragmentos y avisa cuando son una parte del índice. Una síntesis de cinco fragmentos no equivale a leer todo el documento ni a calcular métricas sobre todas las filas de un CSV.
- En la respuesta inmediata de indexación, un PDF se marca como recortado si quedan páginas sin procesar después de alcanzar el límite de texto, incluso cuando los caracteres procesados llenan exactamente ese límite. Ese indicador aún no se conserva al recuperar un índice antiguo; su persistencia está planificada por separado en el hito de IA.
- Los PDF protegidos, dañados o sin texto seleccionable pueden no producir fragmentos. Un DOCX dañado, cifrado o con XML fuera de los límites no se indexa. Un CSV mal formado o con codificación distinta de UTF-8 no se indexa. El OCR de este incremento solo admite PNG, JPEG y WebP. No hay OCR de PDF escaneado ni embeddings. La búsqueda de fragmentos es léxica y acotada a un archivo, no semántica ni de todo el repositorio.
- La lectura de imágenes depende de un **despliegue Azure OpenAI con visión**; que el chat de texto funcione no demuestra esa capacidad. Una incompatibilidad devuelve un error claro sin guardar texto. La transcripción puede omitir o confundir caracteres y siempre requiere comparación visual con el original. El OCR tiene límite de tres solicitudes por usuario cada 15 minutos, timeout de 25 s y registra solo rol, duración, número de fragmentos y tokens, sin imagen ni texto.
- El índice de una carga nueva es de mejor esfuerzo: si falla después de guardar el archivo, la carga permanece y la primera pregunta reintenta la indexación. El JSON de la carga indica `contentIndex.status` (`ready`, `no-text`, `unsupported` o `pending`).
- Las respuestas generadas son borradores de solo lectura. No modifican evidencias, riesgos ni auditorías.

## Puesta en marcha y verificación

1. Aplicar `supabase/migrations/20261016060000_create_evidence_text_chunks.sql` en el proyecto Supabase de VERA antes de publicar la nueva versión. Es una migración aditiva: no cambia los archivos ni metadatos existentes.
2. Confirmar `VERA_EVIDENCE_COMMENT_STORE=supabase`, los almacenes base persistentes y la configuración Azure ya usada por HU-34. No hay claves nuevas.
3. Cargar un TXT, un CSV y un DOCX de prueba vinculados a un riesgo autorizado. Comprobar que la respuesta de carga informa `contentIndex.status=ready`, preguntar por una frase presente, abrir el pasaje citado y descargar el original. Para CSV, comprobar encabezados, fila y aviso de cobertura parcial cuando aplique.
4. Repetir con PDF de texto y una cuenta Auditor ajena: esta debe recibir 404. Probar también pregunta sin coincidencias y PDF escaneado para verificar ausencia de conclusiones inventadas.
5. Cargar una imagen de prueba sin datos reales sensibles; comprobar que no se llama a Azure antes del clic, aceptar la extracción, comparar la transcripción con la imagen, preguntar por una frase visible y abrir la cita. Repetir el clic para comprobar que se usa el índice; con una cuenta ajena, la API debe responder 404 antes de descargar o llamar al modelo. Si el despliegue Azure no admite visión, registrar el error como capacidad pendiente.

Las pruebas automáticas cubren UTF-8, extracción PDF con página, límite de longitud, recuperación léxica, cita obligatoria, indexación diferida, rechazo por rol, OCR explícito con Azure simulado, caché y la interfaz en Chromium, Firefox, móvil y tablet. No sustituyen una prueba con archivos privados reales y un despliegue Azure con visión.

## Referencias técnicas

- [Lectura ZIP acotada con yauzl](https://github.com/thejoshwolfe/yauzl/blob/master/README.md).
- [Parser XML saxes](https://github.com/lddubeau/saxes).
- [Parser CSV y BOM](https://csv.js.org/parse/options/bom/).
- [Extracción de texto con PDF.js en Node](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs).
- [Búsqueda de texto en Supabase/Postgres](https://supabase.com/docs/guides/database/full-text-search). El índice conserva fragmentos para consulta individual y para la búsqueda léxica opcional de evidencias visibles.
- [Imágenes en Azure OpenAI](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/gpt-with-vision): la API de chat admite imágenes mediante URL de datos base64 cuando el modelo desplegado ofrece visión.
