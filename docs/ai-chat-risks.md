# Evaluación de riesgos desde la conversación

Las cuentas `GERENTE` y `SUPER_ADMIN` pueden registrar una nueva evaluación de un riesgo existente sin salir del chat. Ejemplo:

`Evalúa el riesgo «Acceso indebido» con probabilidad 3 e impacto 2 porque la exposición afecta varios procesos.`

También se acepta el identificador `RSK-…`. El título debe identificar un solo riesgo; si se repite, el chat pide el ID. La vista previa presenta factores, nivel, puntaje y justificación. Sólo el siguiente mensaje `Confirmar evaluación`, dentro de cinco minutos, ejecuta el cambio. Cualquier otra pregunta descarta la vista previa. Una conversación sin historial sólo explica cómo operar y no escribe datos.

La ruta HTTP y el chat comparten `riskEvaluationService`: se validan los mismos factores de 1 a 3 y la misma justificación de 10 a 1,000 caracteres. Al confirmar, VERA vuelve a comprobar cuenta, rol, versión del riesgo y número de evaluaciones; el repositorio registra una nueva evaluación versionada con actor y fecha y la bitácora recibe `RISK_EVALUATED`. Las respuestas de Azure y el contenido de archivos nunca se convierten directamente en instrucciones de escritura.

Este flujo evalúa riesgos existentes. La creación y edición de riesgos y controles, el vínculo con evidencias y los hallazgos requieren contratos de datos y permisos propios antes de ofrecerse en chat. La prueba reproducible está en `backend/tests/assistantRiskEvaluation.test.js`; la aceptación con una cuenta real en Production continúa pendiente en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128).
