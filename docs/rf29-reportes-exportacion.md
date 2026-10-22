# RF-28 y RF-29 · Reporte y exportación del portafolio

VERA muestra un reporte de los expedientes visibles desde **Buscar auditorías** y ofrece su descarga CSV. El paso **Reporte** del flujo de una auditoría conduce al mismo reporte filtrado por identificador. El reporte combina auditoría, riesgos, controles y hallazgos vinculados; incluye el número de evidencias relacionadas sin publicar archivos ni enlaces de descarga.

## Contrato y alcance

- `GET /api/planning/report` devuelve `asOf`, `scope`, filtros, total y filas con datos de auditoría y relaciones. Acepta los filtros de `GET /api/planning/search`: `q`, `status`, `risk`, `type`, `quarter`, `year`.
- `GET /api/planning/report?format=csv` descarga el mismo conjunto de filas en CSV UTF-8 con BOM. Cada fila corresponde a un expediente. Las relaciones se listan con identificador y título; las evidencias se cuentan. Si el filtro no encuentra resultados, devuelve encabezados y cero filas.
- Ambas rutas requieren sesión y se calculan en el servidor. La cuenta `AUDITOR` ve solo expedientes asignados y, dentro de ellos, solo riesgos propios y sus controles/hallazgos visibles. Otros roles conservan su alcance de lectura vigente. La respuesta se marca `no-store`.
- El CSV entrecomilla celdas, escapa comillas y neutraliza valores que empiezan con caracteres de fórmula para reducir el riesgo al abrirlo en una hoja de cálculo.

## Evidencia y límites

- Pruebas HTTP: `backend/tests/portfolioReport.integration.test.js` cubre reporte combinado, exportación filtrada, resultado vacío, 401, filtros inválidos y alcance de Auditoría. Prueba de interfaz: `frontend/e2e/portfolio-report.spec.js` cubre aplicar filtro, abrir reporte y descargar CSV.
- Los casos TC-26, TC-27, TC-28 y TC-53 quedan relacionados con estas pruebas en el registro de 78 casos. Esto demuestra el comportamiento local; la aceptación desplegada exige probar con cuentas y datos sintéticos de Supabase, conservar SHA, fecha y resultados.
- El reporte es de lectura y no genera PDF. RNF-15 (reporte de hasta 100 páginas en 10 segundos) sigue sin dictamen: requiere definir formato/paginación, volumen representativo y medición en un entorno autorizado. El conteo de evidencias no sustituye revisar permisos de descarga de cada archivo.

No se modifica el esquema de Supabase ni el estado de propuestas, auditorías o cuentas.
