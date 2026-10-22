# Contexto conectado de una auditoría

Este incremento introduce una lectura común del expediente que también alimenta una ficha para comité. No modifica el modelo de datos ni crea estados nuevos.

## Qué se relaciona

`GET /api/planning/:id/context` devuelve la auditoría solicitada y cuatro grupos: riesgos vinculados por `linkedAuditId`, controles que contienen esos riesgos en `riskIds`, hallazgos asociados a esos riesgos y controles, y evidencias vinculadas directamente a la auditoría o a cualquiera de esos riesgos o controles. Las cifras se calculan a partir de registros guardados, no de valores fijos. Cada respuesta indica `asOf`, alcance y modo de solo lectura. La respuesta incluye metadatos de evidencia, nunca contenido de archivos, rutas privadas de almacenamiento ni enlaces firmados.

El rol Auditor solo puede abrir auditorías asignadas. Dentro del expediente ve sus riesgos, los controles a los que tiene acceso, los hallazgos de esos riesgos y las evidencias de entidades visibles. Para una auditoría ajena la API devuelve 404, igual que si no existiera. Los demás roles conservan la visibilidad de lectura que ya tienen en los módulos actuales. Los conteos de Auditor son, por tanto, *visibles para esa cuenta*, no necesariamente el total global de la auditoría.

## Experiencia

En **Auditorías activas → Abrir expediente → Mapa del expediente**, los conteos llevan a Riesgos, Controles, Hallazgos y Evidencias. Cada riesgo muestra cuántos controles, hallazgos y evidencias relacionados tiene. Las evidencias vinculadas a riesgos o controles ahora aparecen también en la sección Evidencias del expediente. El mapa no califica automáticamente la eficacia de un control ni emite recomendaciones.

## Uso posterior

`relateAudit` centraliza las relaciones y se comparte con el dossier del asistente. Los siguientes incrementos pueden añadir indicadores de cobertura, documentos resumidos y alertas sobre esta misma interpretación, manteniendo el control de acceso en el servidor. Antes de usar esos indicadores para decisiones reales, hay que definir sus reglas de negocio y validar datos y permisos con los responsables del proceso.

## Ficha para comité

Desde **Auditorías activas → Abrir expediente → Ficha para comité** se abre una página interna que puede actualizarse e imprimirse como PDF desde el navegador. Usa la misma respuesta autorizada de `GET /api/planning/:id/context`; no crea otra copia de datos, no llama al modelo de IA y no cambia estados. El enlace directo es `/auditorias-activas/:id/comite` y exige sesión. La API verifica el acceso al registro concreto antes de devolver cualquier dato; para Auditor devuelve 404 si el expediente no está asignado.

La ficha muestra objetivo, alcance, responsable, estado, periodo, avance y clasificación registrados; seis conteos; una tabla de relaciones por riesgo; y listas de hechos para revisar. Los cálculos son: riesgos altos con `level === "Alto"`; riesgos sin control visible cuando ningún control devuelto contiene su ID; controles evaluados de 1 a 3/5; hallazgos abiertos con `status === "OPEN"`; y evidencias según los vínculos de la lectura común. Cada fila conserva los IDs de los registros de origen. La fecha de consulta y el alcance se muestran junto al resultado.

Son **conteos de los registros visibles para la cuenta**, no una certificación de cobertura, eficacia ni riesgo residual. Un cero significa que no aparece ningún registro visible en la categoría consultada. La ficha no contiene el archivo binario de evidencias ni toma decisiones por el comité. Un PDF impreso es una copia puntual y puede quedar desactualizado; para revisar el detalle o cambios posteriores hay que abrir el expediente original.
