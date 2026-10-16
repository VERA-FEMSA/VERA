# Consulta del contenido de evidencias con IA

## Experiencia

En **Evidencias**, cada archivo privado PDF o TXT ofrece **Consultar contenido con IA**. El usuario pregunta por ese archivo concreto. VERA muestra la respuesta, la hora de consulta, la cobertura de fragmentos y los pasajes citados; en PDF, también la página. El enlace de cada cita vuelve a la tarjeta de evidencia, desde donde se puede abrir el archivo original mediante la descarga firmada existente.

Las imágenes PNG, JPEG y WebP no muestran esta acción. Los PDF escaneados sin capa de texto devuelven una explicación de que no se encontró texto legible; no se afirma haber analizado la imagen. Las referencias externas de Drive u otros sistemas tampoco se descargan ni se indexan.

## Flujo de datos y permisos

1. La carga conserva el archivo en el bucket privado `vera-evidence`. Para PDF/TXT, el backend extrae texto, divide cada página en fragmentos de hasta 800 caracteres y los guarda en `vera_evidence_text_chunks` mediante la clave de servidor. El archivo original no se copia a la tabla.
2. Si un archivo previo aún no tiene fragmentos, la primera consulta lo lee desde Storage con la clave de servidor e intenta indexarlo. Esto evita una migración masiva del contenido histórico.
3. `POST /api/evidence/:id/ask` comprueba JWT, existencia del archivo y permiso de lectura sobre el riesgo, control o auditoría vinculados **antes** de leer fragmentos o llamar a Azure. Una evidencia ajena responde 404 sin revelar título ni contenido.
4. La consulta selecciona hasta cinco fragmentos relacionados con los términos de la pregunta. Si no hay texto o coincidencias, responde sin llamar a Azure. Solo esos fragmentos, la pregunta y el rol se envían al despliegue Azure de VERA. No se envían otros archivos ni el portafolio completo.
5. La respuesta generada solo se presenta si cita al menos un fragmento del conjunto permitido. La API devuelve el pasaje exacto y su página. Un ID de cita permitido no verifica automáticamente que la interpretación del modelo sea correcta: el usuario debe revisar el archivo original.

El índice usa la tabla Supabase existente como almacén de fragmentos, sin contratar Azure AI Search. La clave de servicio queda solo en el servidor. La tabla tiene RLS habilitado, no concede acceso a `anon` ni `authenticated` y está ligada a `vera_evidence` por clave foránea. La API aplica RBAC antes de consultar el índice. El rate limit de preguntas es de diez por usuario cada 15 minutos y las respuestas llevan `Cache-Control: no-store`; la telemetría registra rol, modo, duración y tokens, no preguntas ni pasajes.

## Límites explícitos

- Se extraen como máximo **30 páginas** y **40 000 caracteres** por archivo. El contenido adicional no se indexa. Cada respuesta utiliza hasta cinco fragmentos y avisa cuando son una parte del índice. Una síntesis de cinco fragmentos no equivale a leer todo el documento.
- Los PDF protegidos, dañados o sin texto seleccionable pueden no producir fragmentos. No hay OCR ni embeddings. La búsqueda de fragmentos es léxica y acotada a un archivo, no semántica ni de todo el repositorio.
- El índice de una carga nueva es de mejor esfuerzo: si falla después de guardar el archivo, la carga permanece y la primera pregunta reintenta la indexación. El JSON de la carga indica `contentIndex.status` (`ready`, `no-text`, `unsupported` o `pending`).
- Las respuestas generadas son borradores de solo lectura. No modifican evidencias, riesgos ni auditorías.

## Puesta en marcha y verificación

1. Aplicar `supabase/migrations/20261016060000_create_evidence_text_chunks.sql` en el proyecto Supabase de VERA antes de publicar la nueva versión. Es una migración aditiva: no cambia los archivos ni metadatos existentes.
2. Confirmar `VERA_EVIDENCE_COMMENT_STORE=supabase`, los almacenes base persistentes y la configuración Azure ya usada por HU-34. No hay claves nuevas.
3. Cargar un TXT de prueba vinculado a un riesgo autorizado. Comprobar que la respuesta de carga informa `contentIndex.status=ready`, preguntar por una frase presente, abrir el pasaje citado y descargar el original.
4. Repetir con PDF de texto y una cuenta Auditor ajena: esta debe recibir 404. Probar también pregunta sin coincidencias, PDF escaneado e imagen para verificar ausencia de conclusiones inventadas.

Las pruebas automáticas cubren UTF-8, extracción PDF con página, límite de longitud, recuperación léxica, cita obligatoria, indexación diferida, rechazo por rol y la interfaz en Chromium, Firefox, móvil y tablet con proveedor simulado. No sustituyen una prueba con archivos privados reales y Azure en el despliegue.

## Referencias técnicas

- [Extracción de texto con PDF.js en Node](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs).
- [Búsqueda de texto en Supabase/Postgres](https://supabase.com/docs/guides/database/full-text-search). Esta implementación conserva fragmentos para consulta por archivo; no activa todavía búsqueda global de texto.
