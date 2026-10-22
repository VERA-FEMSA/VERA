# RF-06 · Indicadores por periodo en el panel

El panel conserva por defecto el portafolio completo visible para el rol. La persona puede elegir **anual**, **semestral** o **trimestral** y el año correspondiente. El servidor filtra por `year` y `quarter` de cada propuesta antes de calcular los KPI, la distribución de estados, la matriz de riesgo, los hallazgos vinculados y la lista de prioridades. El alcance por rol se mantiene en cada consulta.

`GET /api/dashboard` devuelve la vista sin filtro. `GET /api/dashboard?period=year&year=2026`, `?period=semester&year=2026&semester=1` y `?period=quarter&year=2026&quarter=Q2` devuelven los periodos seleccionados. Los parámetros inválidos devuelven 400. Los semestres corresponden a Q1–Q2 y Q3–Q4.

Los compromisos personales siguen su calendario de vencimiento y **no** se restringen al periodo del portafolio; la pantalla lo indica junto al selector. No hay cambios de esquema ni de persistencia. La evidencia de código se relaciona con TC-41; su aceptación con datos del entorno desplegado sigue pendiente de dictamen individual.
