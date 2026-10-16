# Estado de aceptación de historias de usuario

Revisión del código en `main` y de las capturas de Azure DevOps compartidas por el equipo, actualizada el 16 de octubre de 2026. El estado “Resolved” en Azure DevOps no prueba por sí solo que todos los criterios se cumplan en el despliegue. La base de datos Supabase tiene migraciones, pero los almacenes persistentes son optativos y no se ha verificado la configuración del despliegue de Vercel.

| HU | Evidencia implementada en el repositorio | Pendiente para afirmar aceptación completa |
| --- | --- | --- |
| 07 Panel principal | `GET /api/dashboard`, métricas y pendientes según rol; KPI de hallazgos abiertos vinculados a auditorías visibles, con alcance del riesgo para Auditoría; pruebas unitarias e integración. | Verificar datos persistentes en el entorno desplegado y contrastar todos los criterios de Azure DevOps. |
| 09 Auditorías activas y matriz | `GET /api/planning/active`, matriz 3×3, vínculos con riesgos, controles y hallazgos reales en el expediente. | Verificación remota con datos Supabase, incluida navegación y permisos. |
| 14 Riesgos | API y pantalla de registro, evaluación versionada, filtros, RBAC; modo Supabase optativo. | Confirmar criterios completos de Azure DevOps, persistencia y permisos en el despliegue. |
| 15 Controles | API y pantalla de controles, asociación con múltiples riesgos, evaluaciones versionadas con resultado explícito efectivo/inefectivo, justificación, evaluador y fecha; referencias de evidencia y modo Supabase optativo. El incremento HU-15 agrega hallazgos ligados a control, riesgo y versión de evaluación; Auditoría puede crear uno en un riesgo asignado. | Confirmar persistencia remota y los criterios oficiales completos. El registro de controles y sus evaluaciones sigue reservado a roles de gestión hasta reconciliar la matriz de permisos de VERA. |
| 16 Evidencias | API y pantalla de referencias y archivos pequeños vinculados a riesgo, control o auditoría; carga privada en Supabase Storage, límite 3 MB y descarga firmada tras comprobar permisos. La décima migración y el bucket privado están aplicados. | Activar metadatos persistentes en Vercel y probar carga, lectura y persistencia reales. Revisar criterios oficiales completos y requisitos de archivos mayores a 3 MB. |
| 17 Notificaciones | Bandeja de pendientes derivados, navegación contextual y estado de lectura por usuario con API y modo Supabase optativo; undécima migración aplicada. | Activar el modo en Vercel y verificar lectura después de reinicio. Los criterios completos no aparecen en las capturas; no hay canal de correo/push. |
| 18 Historial y comentarios | API y UI de eventos/comentarios; modos Supabase optativos. | Confirmar criterios completos y persistencia/auditoría en el despliegue. |
| 19 Concurrencia y navegadores | Playwright cubre Chrome, Edge, Firefox, móvil y tablet; existe un script k6 de carga. | Ejecutar y documentar una prueba real de 150 usuarios concurrentes y otra de al menos 250, con cuentas/datos y entorno de pruebas adecuados. El script preparado no equivale a una corrida. |
| 22 Propuestas | API/UI de creación, edición, validaciones y pruebas; modo Supabase optativo. | Validación funcional y persistencia en el despliegue. |
| 23 Decisiones | API/UI de aprobación/rechazo y bitácora; modo Supabase optativo. | Validación funcional y persistencia en el despliegue. |
| 26 Búsqueda y filtros | PR #55 agregó `GET /api/planning/search` y `/auditorias`, con filtros de texto, estado, riesgo, tipo, trimestre y año. El alcance de Auditoría se aplica antes de buscar. | Contrastar con los criterios completos de Azure DevOps y validar en el despliegue. |
| 34 Asistente IA | Interfaz `/asistente`, API autenticada de solo lectura, contexto filtrado por rol, enlaces del servidor, pruebas y recurso/despliegue Azure OpenAI con llamada local real. Ver [runbook HU-34](hu34-azure-openai.md). | Activar secretos y almacenes persistentes en el proyecto Vercel actual, probar con cuentas reales y comparar todos los criterios en producción. Sin acceso a `figbo/vera` no hay aceptación remota. |

## Secuencia de cierre

1. Validar HU-26 en el despliegue y contrastar sus filtros con los criterios completos.
2. Completar la validación remota de HU-15 y reconciliar con la matriz de permisos de VERA quién puede registrar y evaluar controles.
3. Validar carga, almacenamiento, descarga autorizada y vínculo de HU-16 en el despliegue; conservar la distinción entre archivo y referencia externa.
4. Obtener criterios completos de HU-17/HU-18 y comprobar los modos Supabase en un despliegue con acceso del propietario.
5. Ejecutar la prueba de carga de HU-19 en un entorno de pruebas autorizado; registrar tasa, latencia, errores y límites. No ejecutarla contra producción sin una ventana coordinada.
6. Reconciliar el estado de Azure DevOps con evidencia de aceptación. HU-34 tiene implementación verificable, pero su activación remota sigue condicionada a persistencia y acceso al despliegue.

## Evidencia y límites

- Código: `backend/controllers`, `backend/routes`, `backend/repositories`, `frontend/src/pages`, `backend/tests`, `supabase/migrations`.
- PR previos: [HU-14](https://github.com/humbertofigb15/VERA/pull/19), [HU-15](https://github.com/humbertofigb15/VERA/pull/21), [HU-16](https://github.com/humbertofigb15/VERA/pull/23), [HU-17](https://github.com/humbertofigb15/VERA/pull/22), [HU-18](https://github.com/humbertofigb15/VERA/pull/20), [HU-19](https://github.com/humbertofigb15/VERA/pull/29) y [carga preparada](https://github.com/humbertofigb15/VERA/pull/30).
- Incrementos de esta revisión: [HU-26](https://github.com/humbertofigb15/VERA/pull/55), [HU-15](https://github.com/humbertofigb15/VERA/pull/56), [HU-16](https://github.com/humbertofigb15/VERA/pull/57), [HU-17](https://github.com/humbertofigb15/VERA/pull/58) y [HU-07/HU-09](https://github.com/humbertofigb15/VERA/pull/59).
- Capturas de esta revisión: muestran criterios detallados de HU-15 y HU-34, además de estados y títulos de otras HU. Las capturas anteriores de HU-07, HU-09, HU-22 y HU-23 muestran algunos criterios, pero para la aceptación final se requiere el texto oficial completo. Esta matriz identifica brechas demostrables sin inventar criterios.
