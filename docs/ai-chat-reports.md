# Reportes desde la conversación

El chat admite `Muéstrame el reporte del portafolio` para ver un resumen calculado de las auditorías visibles, por estado y con fecha de consulta. Muestra hasta diez expedientes como muestra con enlaces a sus registros; el conteo se calcula sobre todos los registros autorizados.

Con `Exporta el reporte del portafolio en CSV`, VERA prepara el mismo archivo de RF-29 y lo descarga directamente desde el navegador, sin abandonar la conversación. El archivo contiene todas las filas del reporte para esa cuenta, incluye encabezados UTF-8 y neutraliza fórmulas en celdas. Si el navegador bloquea la descarga, la conversación queda guardada y el usuario puede repetir la instrucción.

La lógica reutiliza `buildPortfolioReport` y `reportToCsv`, incluidas sus reglas de visibilidad por rol. Un CSV de hasta 2 MB viaja en la respuesta autenticada que lo solicitó; si es mayor, el navegador invoca el endpoint RF-29 para descargarlo sin cargarlo en el chat y advierte que los datos pueden haber cambiado desde el resumen. **El CSV no se persiste en el historial de chat**; allí quedan sólo el resumen, el momento de consulta y una muestra de enlaces. No se usa Azure OpenAI ni se consumen tokens para calcular cifras o generar el archivo. Esta capacidad no cambia datos ni concede acceso a expedientes adicionales.

Las pruebas de `backend/tests/assistantReports.test.js` comparan el CSV del chat con el endpoint RF-29 y comprueban que un Auditor no reciba una propuesta sin asignar. La prueba de interfaz comprueba la descarga en el navegador sin navegar a otro módulo. La aceptación autenticada en Production sigue pendiente en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128).
