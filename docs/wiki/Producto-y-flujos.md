# Producto y flujos

## Qué problema aborda

En un portafolio de auditorías, las iniciativas, evaluaciones, controles y evidencias suelen quedar dispersos. VERA reúne esas piezas en un recorrido consultable, con decisiones registradas y vistas acordes al usuario. Su objetivo es facilitar seguimiento y trazabilidad; no reemplaza el juicio profesional de auditoría.

## Ciclo de una auditoría

1. **Proponer.** Una persona autorizada registra objetivo, alcance, justificación, responsable y periodo estimado. El sistema valida los datos y deja la propuesta abierta para revisión.
2. **Decidir.** El rol autorizado aprueba o rechaza. Un rechazo exige motivo y conserva la decisión; una propuesta aprobada puede pasar a ejecución.
3. **Ejecutar.** La auditoría activa se muestra en el portafolio y en la matriz de probabilidad × impacto. Se puede seguir su avance y su relación con riesgos.
4. **Sustentar.** Riesgos, controles, evaluaciones, evidencias, hallazgos, comentarios y actividad aportan contexto al expediente.
5. **Cerrar.** El cierre registra actor y fecha. Los registros históricos se mantienen consultables según permisos.

Este es el flujo implementado a nivel de aplicación; la [matriz de aceptación](https://github.com/humbertofigb15/VERA/blob/main/docs/hu-acceptance-audit.md) distingue verificaciones pendientes en producción.

## Vistas principales

| Vista | Pregunta que responde |
| --- | --- |
| Panel de portafolio | ¿Qué indicadores y decisiones requieren mi atención? |
| Planificación | ¿Qué propuestas están abiertas, aprobadas o rechazadas? |
| Auditorías activas y búsqueda | ¿Qué auditorías están en curso y dónde se concentran los riesgos? |
| Riesgos y controles | ¿Qué se evaluó, qué medidas existen y qué hallazgos surgieron? |
| Evidencias y actividad | ¿Qué sustento y cambios tiene cada expediente? |
| Pendientes | ¿Qué tareas visibles siguen abiertas para mí? |
| Asistente de VERA | ¿Qué registros autorizados responden a una pregunta o explican una prioridad? |

La interfaz tiene rutas explícitas en [`frontend/src/App.jsx`](https://github.com/humbertofigb15/VERA/blob/main/frontend/src/App.jsx). El acceso y el alcance real de datos se determinan en el servidor, no por la presencia de un botón.

## Cómo explorarla

- [Abrir la aplicación](https://vera-salva-ventures.vercel.app). Se necesita una cuenta activa de VERA; el login de Azure DevOps no se comparte automáticamente.
- Para una evaluación sin cuenta, abre los [resultados de GitHub Actions](https://github.com/humbertofigb15/VERA/actions) y el [plan de pruebas](https://github.com/humbertofigb15/VERA/blob/main/docs/testing/test-plan.md).
- Para ver la implementación de una historia concreta, sigue [Módulos y HU](https://github.com/humbertofigb15/VERA/wiki/Modulos-y-HU).
