# VERA

**VERA** es una aplicación web en desarrollo para apoyar flujos de auditoría, planificación y administración de usuarios. Este repositorio incluye una interfaz React y una API Express, junto con verificaciones de calidad ejecutadas localmente y en GitHub Actions.

[![Calidad de software](https://github.com/humbertofigb15/VERA/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/humbertofigb15/VERA/actions/workflows/quality.yml)
[![Ejecución completa](https://github.com/humbertofigb15/VERA/actions/workflows/classroom-quality.yml/badge.svg?branch=main)](https://github.com/humbertofigb15/VERA/actions/workflows/classroom-quality.yml)
[![CodeQL](https://github.com/humbertofigb15/VERA/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/humbertofigb15/VERA/actions/workflows/codeql.yml)

[▶ Abrir ejecución completa de calidad y pruebas](https://github.com/humbertofigb15/VERA/actions/workflows/classroom-quality.yml) · [Guía rápida para revisión docente](docs/testing/professor-quick-run.md)

> **Estado:** prototipo académico. Por defecto los datos se mantienen en memoria y se reinician con el backend. El código permite activar progresivamente la persistencia de planificación, cuentas, riesgos, controles, evidencias, comentarios y bitácora en Supabase siguiendo [esta guía](docs/supabase-planning.md). La conexión, las migraciones y los triggers aún requieren verificación en el proyecto remoto del equipo. El modo demo contiene cuentas de ejemplo y no debe usarse con datos reales.

## Funcionalidades actuales

- Registro con aprobación de cuenta y acceso por roles.
- Inicio de sesión con opción de autenticación de dos factores TOTP.
- Administración de usuarios y consulta de actividad de auditoría.
- Creación, edición y aprobación de propuestas de planificación.
- Reglas y pruebas de integración para el ciclo de propuestas de auditoría (HU-22).
- Rechazo trazable de propuestas de auditoría con motivo obligatorio (HU-23).
- Inicio, seguimiento y cierre de auditorías aprobadas con matriz 3 × 3 de riesgos (HU-09).
- Panel principal con estadísticas, gráficas y acciones ajustadas a permisos del rol (HU-07).
- Interfaz web para acceso, usuarios, auditoría, planificación y trimestres.

## Tecnologías

| Componente | Tecnologías |
| --- | --- |
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express, express-rate-limit |
| Autenticación | JWT, bcryptjs, TOTP |
| Calidad | Node test runner, cobertura, ESLint, build de Vite, npm audit |
| Automatización | GitHub Actions, CodeQL y Dependabot |

## Requisitos

- Node.js 22 o superior.
- npm incluido con Node.js.

## Configuración local

Desde la raíz del repositorio, instala las dependencias:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

Crea el archivo local de configuración a partir de la plantilla:

```powershell
Copy-Item .env.example .env
```

Genera una clave aleatoria para `JWT_SECRET` y agrégala al archivo `.env`. Debe tener al menos 32 caracteres; no uses una clave compartida ni la subas al repositorio.

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

El backend lee `.env` desde la raíz del repositorio y usa el puerto `3000` por defecto. Inícialo en una terminal:

```powershell
npm start --prefix backend
```

En otra terminal, inicia el frontend:

```powershell
npm run dev --prefix frontend
```

Vite muestra la dirección local de la interfaz al iniciar. Las llamadas `/api` se redirigen al backend local mediante la configuración de desarrollo de Vite.

## Comandos de calidad

Desde la raíz del proyecto:

| Comando | Verificación |
| --- | --- |
| `npm run quality` | Ejecuta todas las verificaciones y genera el resumen local en `quality-report/`. |
| `npm run test:coverage` | Pruebas del backend y reporte de cobertura. |
| `npm run lint` | Revisión de sintaxis del backend y ESLint del frontend. |
| `npm run build` | Build de producción del frontend. |
| `npm run audit` | Auditoría de dependencias de backend y frontend. |

El flujo de GitHub Actions ejecuta las verificaciones de calidad en pull requests dirigidos a `main` y en actualizaciones de `main`. El reporte detallado del workflow se conserva como artefacto de Actions durante 14 días.

El workflow **VERA — Calidad y pruebas completas** ejecuta en una sola corrida calidad backend/frontend, compatibilidad y accesibilidad de interfaz, y CodeQL. Se puede iniciar desde **Actions → VERA — Calidad y pruebas completas → Run workflow** y presenta resumen, resultados y duración sin instalar herramientas localmente. También corre cada lunes. La prueba de carga permanece separada porque requiere un staging aprobado y una cuenta dedicada. Revisa [la guía rápida para revisión docente](docs/testing/professor-quick-run.md).

### HU-22: creación de propuestas de auditoría

El flujo permite crear propuestas con título, objetivo, alcance, justificación, área, tipo, nivel de riesgo, año y periodo estimado (trimestre o ambas fechas). También admite responsable. El backend exige estos datos, limita alcance y justificación a 2000 caracteres, valida catálogos, fechas, auditor responsable activo y duplicados por título, área y año. Las propuestas empiezan abiertas y quedan disponibles para revisión; se pueden editar mientras sigan abiertas y solo roles `SUPER_ADMIN` o `DIRECTOR` pueden aprobarlas. La aprobación requiere un trimestre válido y fija el avance en 100%; una propuesta aprobada queda protegida contra edición y eliminación. Las propuestas históricas sin alcance o justificación deben completarse al editarlas.

Para HU-11, `JEFATURA` puede crear propuestas y editar solo las propias mientras sigan abiertas. `AUDITOR` puede consultar sus asignaciones, pero no crear propuestas. Solo `SUPER_ADMIN` puede eliminar propuestas abiertas. Los permisos de propuestas están separados de los de riesgos y controles, que conservan sus roles actuales. La correspondencia con la matriz CRUD recibida y sus límites se documenta en [Permisos de auditorías y matriz CRUD](docs/permissions/hu11-crud-mapping.md).

Las pruebas de integración de `backend/tests/planning.integration.test.js` verifican el flujo HTTP de creación, validación, duplicidad, edición, aprobación y permisos. Se ejecutan con `npm run test:coverage --prefix backend` y forman parte de `npm run quality`.

### HU-12: edición de auditorías

Una auditoría aprobada o en curso se puede corregir con `PATCH /api/planning/:id/details`, solo por `SUPER_ADMIN` o `DIRECTOR`. Las reglas están en `backend/config/auditEditRules.js`: aprobada permite cambiar objetivo, responsable, trimestre, fechas, probabilidad e impacto; en curso solo objetivo, responsable y fecha de fin. Título, área, tipo y año no cambian después de aprobar, y las auditorías cerradas o rechazadas no se editan. Cada edición valida con las mismas reglas de HU-22, recalcula el riesgo si cambian probabilidad o impacto y registra el evento `AUDIT_UPDATED` con el valor anterior y el nuevo de cada campo, visible en el historial del expediente. En la pantalla *Auditorías activas* el botón **Editar** abre un formulario que solo muestra los campos permitidos.

### HU-23: revisión, aprobación o rechazo

Los roles `SUPER_ADMIN` y `DIRECTOR` pueden resolver una propuesta abierta. El rechazo requiere un motivo no vacío, registra quién decidió y cuándo, guarda el motivo en la propuesta y genera el evento `AUDIT_PROPOSAL_REJECTED` con el mismo motivo. La pantalla separa propuestas rechazadas de las abiertas y muestra su motivo y responsable de decisión. Las propuestas rechazadas no se pueden editar, aprobar, volver a rechazar ni eliminar. Las propuestas aprobadas tampoco se pueden editar ni eliminar; su única transición posterior es iniciar la auditoría. Las pruebas de integración comprueban permisos, motivo requerido, registro de decisión y rechazo de cambios posteriores.

### HU-09: auditorías activas y matriz de riesgos

La planificación captura probabilidad e impacto en una escala de 1 (bajo) a 3 (alto); la API calcula el puntaje como su producto y clasifica 1–2 como bajo, 3–4 como medio y 6–9 como alto. La matriz 3 × 3 cuenta las auditorías que están en curso por ambas dimensiones. Al seleccionar una celda se muestran las auditorías correspondientes, los riesgos registrados vinculados y sus controles cuando existen; desde cada riesgo vinculado se puede navegar a la auditoría activa. Una auditoría solo puede iniciarse después de ser aprobada y asignada a un trimestre. `SUPER_ADMIN` o `DIRECTOR` pueden iniciar o cerrar; el inicio registra actor y fecha con avance de ejecución en 0%, y el cierre registra actor y fecha con avance en 100%. El endpoint `GET /api/planning/active` alimenta el tablero; los eventos `AUDIT_STARTED` y `AUDIT_CLOSED` aparecen en el registro de actividad. HU-12 permite corregir campos concretos de auditorías aprobadas o activas; las cerradas y rechazadas no se editan. Una auditoría cerrada sale de la matriz activa y permanece en el calendario trimestral con su avance real.

### HU-07: panel principal por rol

`GET /api/dashboard` requiere sesión y devuelve métricas, conteos por estado, matriz activa, pendientes y permisos calculados desde el portafolio. Super Admin y Dirección ven la cola global de decisiones; Gerencia y Jefatura pueden dar seguimiento y proponer auditorías; Auditoría ve solo registros asignados por `responsibleId`. La interfaz muestra KPIs, barras de estado, matriz de riesgo 3 × 3 y acciones rápidas filtradas por permisos; los valores se consultan de nuevo al actualizar y no están hardcodeados. Las pruebas de integración verifican autenticación, alcance de auditoría y permisos. No se muestran horas ni hallazgos porque el modelo actual no contiene fuentes de esos datos; así se evita presentar estadísticas inventadas.

Con `VERA_PLANNING_STORE=supabase`, esos conteos y pendientes de propuestas se calculan desde auditorías persistidas en Supabase. La [guía de activación](docs/supabase-planning.md) explica la secuencia de migraciones y modos opcionales de los demás dominios.

### HU-14: registro y evaluación de riesgos

`/riesgos` mantiene un registro independiente de las propuestas de auditoría. Cada riesgo requiere nombre, descripción, área, responsable con cuenta activa y una evaluación inicial justificada; puede vincularse con una propuesta existente y documentar un plan de respuesta. Probabilidad e impacto usan valores enteros de 1 a 3; el puntaje es su producto y conserva los umbrales de HU-09: 1–2 bajo, 3–4 medio y 6–9 alto. El servidor calcula el nivel, detecta duplicados por nombre y área sin distinguir mayúsculas, filtra por nivel y búsqueda, y registra creación, cambios y reevaluaciones en la bitácora.

Cada reevaluación conserva versión, factores, puntaje, nivel, justificación, usuario y fecha; no sobrescribe el historial anterior. `SUPER_ADMIN`, `DIRECTOR` y `GERENTE` pueden registrar, editar y reevaluar. Los auditores pueden consultar solo los riesgos que tienen asignados; otros roles autenticados tienen acceso de lectura global. Endpoints: `GET /api/risks`, `GET /api/risks/owners`, `POST /api/risks`, `PUT /api/risks/:id` y `POST /api/risks/:id/evaluate`; las rutas exigen sesión y las operaciones de escritura aplican autorización por rol.

El alcance actual no incluye cierre del riesgo ni archivos binarios adjuntos. Por defecto el registro usa memoria; se puede activar el almacén persistente de riesgos y controles tras aplicar las migraciones y activar las cuentas y la planificación en Supabase. Las pruebas de integración cubren autenticación, permisos, validación de escalas y justificación, cálculo de categoría, duplicados, filtros, alcance del auditor y conservación de versiones.

### HU-15: controles y cobertura de riesgos

`/controles` registra controles preventivos, detectivos o correctivos, su responsable, frecuencia y los riesgos que atienden. El mapa muestra la relación riesgo-control y el nivel de efectividad (1–5), además del porcentaje de riesgos visibles que tienen al menos un control vinculado. Las evaluaciones conservan versiones, justificación, autor y fecha. El nivel es un dato descriptivo y no se usa para modificar automáticamente la clasificación del riesgo. La API `GET/POST /api/controls`, `PUT /api/controls/:id` y `POST /api/controls/:id/evaluate` exige sesión; `SUPER_ADMIN`, `DIRECTOR` y `GERENTE` administran el catálogo. Auditoría solo ve controles relacionados con riesgos asignados a su usuario.

El modelo de controles y evaluaciones usa memoria en el demo y comparte el modo Supabase optativo con los riesgos, sin cambiar la interfaz HTTP.

### HU-17: bandeja de notificaciones y actividades pendientes

`/notificaciones` presenta una bandeja interna con propuestas abiertas para decisión, propuestas creadas que esperan revisión, auditorías aprobadas listas para iniciar y auditorías activas asignadas. Los elementos se derivan al consultar `GET /api/notifications`, se filtran según el rol y la asignación y se ordenan por prioridad. Los botones llevan a las pantallas existentes para completar la acción.

Es una bandeja dentro de la aplicación: no envía correo ni push, no crea notificaciones duplicadas y no persiste estados de lectura. El conteo representa la situación actual del portafolio, por lo que cambia cuando cambian los estados de las propuestas. La interfaz y el servicio quedan separados para que el equipo pueda agregar después persistencia, preferencias y canales de entrega.

### HU-16: referencias de evidencia vinculadas

`/evidencias` registra una referencia documental y la relaciona con un riesgo, control o auditoría existente. El registro incluye nombre, tipo, descripción, referencia externa, entidad relacionada, autor y fecha. `GET /api/evidence` permite filtrar por entidad o búsqueda; `POST /api/evidence` valida el destino y conserva el evento `EVIDENCE_REGISTERED`. Las personas con rol Auditoría solo consultan o agregan referencias a riesgos/auditorías asignados y a controles que cubren riesgos asignados.

Este incremento no recibe ni almacena archivos binarios. Acepta un enlace HTTPS o identificador externo (por ejemplo, nombre de archivo o referencia de Drive); solo los enlaces HTTPS se muestran como vínculos clicables. Los metadatos usan memoria en el demo y pueden guardarse en Supabase con el modo optativo de evidencias y comentarios.

### HU-18: historial, actividad y comentarios por auditoría

Desde Planificación, Auditorías activas/aprobadas y el detalle trimestral se puede abrir el historial contextual de cada propuesta. La API `GET /api/planning/:id/history` combina eventos existentes de creación, edición, aprobación, rechazo, inicio y cierre con los comentarios del expediente. El identificador del expediente filtra los eventos relacionados; las vistas de Auditoría mantienen el alcance asignado, y las cuentas sin sesión no pueden consultar el recurso.

`POST /api/planning/:id/comments` permite a cualquier usuario autenticado que pueda consultar esa propuesta agregar comentarios de 3 a 2,000 caracteres. El texto se recorta en los extremos, pero se conserva tal como se escribió en el contenido; autor, rol y fecha quedan asociados. Cada comentario produce además el evento `AUDIT_COMMENT_ADDED` en la bitácora general. No se permite editar o borrar comentarios desde esta HU, para mantener su valor como registro de actividad.

Los comentarios y eventos usan memoria en el demo. Existen modos optativos para guardar comentarios y bitácora en Supabase, sujetos a la aplicación de las migraciones y a la verificación del entorno remoto. Las pruebas de integración comprueban autenticación, asignación de acceso, filtros de eventos por expediente, ciclo de vida completo, validación de comentarios, identidad del autor y la bitácora generada.

CodeQL analiza JavaScript y TypeScript en los pull requests, en `main` y semanalmente. `npm audit` revisa dependencias de backend y frontend en el flujo de calidad. Dependabot revisa semanalmente dependencias npm y GitHub Actions.

## Estructura

```text
.
├── backend/                 # API, autenticación, rutas, servicios y pruebas
├── frontend/                # Interfaz React y configuración de Vite
├── scripts/                 # Ejecutor del flujo local de calidad
├── supabase/migrations/      # Esquema SQL versionado para los modos persistentes
├── .github/workflows/       # Calidad, CodeQL y revisión de dependencias
├── .env.example             # Plantilla local; no contiene secretos
└── quality-report/          # Informes locales y artefactos de calidad (ignorado por Git)
```

## Seguridad y limitaciones

- Configura una clave JWT aleatoria en `.env`; el backend se detiene si falta o tiene menos de 32 caracteres.
- La API limita cada IP a 100 solicitudes por ventana de 15 minutos y responde con `429` al excederla. El almacenamiento predeterminado del límite es en memoria y no se comparte entre varias instancias.
- `.env` está excluido de Git. Comparte únicamente `.env.example`, nunca el archivo local.
- Todos los almacenes usan memoria por defecto. Los modos Supabase son optativos y deben activarse en el orden documentado, tras conciliar el esquema y los datos existentes.
- Las cuentas y contraseñas de demostración son solo para desarrollo y no deben reutilizarse.
- Antes de usar datos reales, se requiere aplicar y verificar las migraciones en el proyecto del equipo, activar los modos persistentes, gestionar los secretos en la plataforma, configurar CORS, compartir el estado del límite de solicitudes entre instancias, retirar las cuentas demo del entorno y evaluar la seguridad del despliegue.

## Contribuir

1. Crea una rama de trabajo desde `main`.
2. Mantén cada pull request enfocado en una funcionalidad o cambio de seguridad.
3. Ejecuta `npm run quality` desde la raíz y revisa el resultado antes de abrir el pull request.
4. Espera a que las verificaciones de GitHub Actions y CodeQL terminen.

Los requisitos funcionales en curso se gestionan en las historias de usuario del proyecto; este README describe únicamente el comportamiento existente en el código.
