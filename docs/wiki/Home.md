# VERA · Centro de conocimiento

<img src="https://raw.githubusercontent.com/humbertofigb15/VERA/main/frontend/public/vera-logo.png" alt="Isotipo VERA" width="112">

**Verificación, evidencia, riesgo y auditoría.** Esta Wiki conecta la experiencia del producto con sus decisiones de diseño, controles técnicos y evidencia de calidad. Está escrita para docentes, usuarios de negocio, personas desarrolladoras y responsables de operación.

<img src="https://raw.githubusercontent.com/humbertofigb15/VERA/main/docs/assets/planificacion-demo.png" alt="Vista real del módulo Planificación con indicadores y una propuesta abierta; datos de demostración" width="760">

*Vista real de Planificación compartida por el equipo · datos de demostración.*

> **Cómo leer el estado:** VERA es un prototipo académico en evolución. «Implementado en código», «aprobado en CI» y «aceptado en producción» son afirmaciones distintas. Consulta [Estado y evidencias](https://github.com/humbertofigb15/VERA/wiki/Modulos-y-HU) antes de cerrar una HU.

## Elige tu recorrido

| Si quieres... | Empieza aquí | Después |
| --- | --- | --- |
| Entender la solución en 5 minutos | [Producto y flujos](https://github.com/humbertofigb15/VERA/wiki/Producto-y-flujos) | [Módulos y HU](https://github.com/humbertofigb15/VERA/wiki/Modulos-y-HU) |
| Evaluar al equipo sin instalar software | [Calidad y pruebas](https://github.com/humbertofigb15/VERA/wiki/Calidad-y-pruebas) | [Guía rápida docente](https://github.com/humbertofigb15/VERA/blob/main/docs/testing/professor-quick-run.md) |
| Comprender cómo funciona | [Arquitectura](https://github.com/humbertofigb15/VERA/wiki/Arquitectura) | [Datos y Supabase](https://github.com/humbertofigb15/VERA/wiki/Datos-y-Supabase) |
| Revisar quién puede hacer qué | [Acceso y permisos](https://github.com/humbertofigb15/VERA/wiki/Acceso-y-permisos) | [Política vigente en código](https://github.com/humbertofigb15/VERA/blob/main/backend/config/roles.js) |
| Conocer la IA | [IA de VERA](https://github.com/humbertofigb15/VERA/wiki/IA-de-VERA) | [Evaluación continua](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-continuous-evaluation.md) |
| Desarrollar o desplegar | [Contribuir](https://github.com/humbertofigb15/VERA/wiki/Contribuir) | [Operación y despliegue](https://github.com/humbertofigb15/VERA/wiki/Operacion-y-despliegue) |
| Encontrar un documento técnico | [Biblioteca de runbooks](https://github.com/humbertofigb15/VERA/wiki/Biblioteca-de-runbooks) | [Glosario](https://github.com/humbertofigb15/VERA/wiki/Glosario) |

## La idea en una frase

VERA reúne propuesta, decisión, auditoría, riesgo, control, evidencia y seguimiento en un mismo recorrido, con datos visibles según los permisos del usuario.

```mermaid
flowchart LR
  P[Propuesta] --> D{Decisión}
  D -->|Aprobada| A[Auditoría]
  D -->|Rechazada| R[Motivo registrado]
  A --> G[Riesgos y controles]
  G --> E[Evidencias y hallazgos]
  E --> S[Seguimiento]
```

## Enlaces directos

- [Repositorio y README](https://github.com/humbertofigb15/VERA) · [Aplicación publicada](https://vera-salva-ventures.vercel.app) — requiere cuenta de VERA.
- [Workflow integral para docentes](https://github.com/humbertofigb15/VERA/actions/workflows/classroom-quality.yml) · [PR fusionados](https://github.com/humbertofigb15/VERA/pulls?q=is%3Apr+is%3Amerged).
- [Plan de pruebas](https://github.com/humbertofigb15/VERA/blob/main/docs/testing/test-plan.md) · [Matriz de aceptación](https://github.com/humbertofigb15/VERA/blob/main/docs/hu-acceptance-audit.md).

**Fuentes de verdad.** La Wiki explica y orienta; el comportamiento vigente se verifica en el código de `main`, sus pruebas y el entorno concreto. Los runbooks de `docs/` son la referencia operativa versionada. La versión revisable de estas páginas vive en [`docs/wiki/`](https://github.com/humbertofigb15/VERA/tree/main/docs/wiki). Si se contradicen, registra el archivo y el commit antes de corregir la página.
