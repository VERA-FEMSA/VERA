# Búsqueda de evidencias desde el copiloto

El usuario puede marcar **Buscar también en textos de evidencias visibles** antes de enviar su pregunta. VERA combina registros de auditorías, riesgos, controles, hallazgos y pendientes que su rol puede leer con hasta cinco fragmentos PDF/DOCX/TXT/CSV o imagen **ya indexada** coincidentes. Cada fragmento citado muestra el pasaje, la página cuando existe y un enlace a la evidencia. La respuesta es de solo lectura.

## Alcance y autorización

El servidor construye primero el alcance con `buildAssistantContext`. A partir de esos IDs visibles filtra evidencias vinculadas a riesgos, controles o auditorías. Solo envía al índice los IDs autorizados; vuelve a comprobar que cada resultado pertenezca a esa lista antes de pasarlo al modelo o al navegador. La API usa la clave de servidor, mientras la función SQL solo concede `EXECUTE` a `service_role`. El navegador nunca envía la lista de IDs permitidos ni la clave Supabase.

La consulta usa **solo fragmentos ya indexados**. Los archivos anteriores se indexan al abrir su consulta individual; esta búsqueda no descarga ni procesa el portafolio completo. Se consideran hasta 500 archivos visibles y se muestran `visibleFiles`, `searchedFiles` y un aviso si se superó el límite. Una respuesta sin un ID de fragmento permitido se descarta. Una cita válida demuestra que el fragmento fue recuperado dentro del alcance; el usuario debe verificar la interpretación en el archivo original.

La búsqueda usa `plainto_tsquery('spanish', ...)` y un índice GIN en Supabase/Postgres, sin Azure AI Search ni embeddings. Es léxica, depende del texto extraído y puede no hallar sinónimos, imágenes sin OCR iniciado o PDF escaneados. Una pregunta sin coincidencias no llama a Azure. [Supabase documenta la búsqueda de texto en Postgres](https://supabase.com/docs/guides/database/full-text-search).

## Contrato y operación

`POST /api/assistant/search-evidence` recibe `{ "question": "...", "focus": null }`; `focus` admite los expedientes del chat general. Requiere sesión y Azure disponible, limita la pregunta a 500 caracteres y cinco peticiones por usuario cada 15 minutos. Devuelve `answer`, `mode`, `citations`, `references`, `coverage`, `asOf`, `durationMs` y `usage`. La respuesta es `Cache-Control: no-store`. La telemetría registra rol, duración, modo y tokens; nunca la pregunta ni los pasajes.

Aplicar la migración aditiva `20261017010000_search_evidence_text_chunks.sql` antes del despliegue. El índice existente de fragmentos se conserva; la migración agrega un índice lingüístico y una función privada. La consulta individual de un archivo y el chat general sin la casilla mantienen sus rutas actuales.

## Comprobaciones

- Cuenta autorizada: preguntar por una expresión presente en un PDF/DOCX/TXT/CSV indexado y abrir el fragmento citado.
- Cuenta ajena: repetir con un archivo vinculado a una entidad fuera de su alcance; no debe figurar en la búsqueda ni llegar al modelo.
- Pregunta sin coincidencia: mensaje de ausencia, sin inferir una respuesta.
- Archivo previo sin índice, imagen sin OCR y PDF escaneado: explicar el alcance y usar la consulta individual cuando corresponda. El OCR de imagen requiere un clic explícito en Evidencias y un modelo Azure con visión.
- Más de 500 archivos visibles: resultado parcial explícito.

Las pruebas automáticas usan datos y proveedor simulados. La aceptación con cuentas reales en el despliegue sigue el procedimiento de [aceptación de producción](ai-production-acceptance.md).
