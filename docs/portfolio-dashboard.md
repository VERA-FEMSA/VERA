# Panel de Portafolio: lectura, decisiones y alcance

Esta guía documenta la primera pantalla después del acceso a VERA. Corresponde a la experiencia de la HU-07 y describe lo que muestra el frontend, el origen de los datos y los límites de interpretación. El panel es un resumen operativo; no sustituye los expedientes ni las decisiones registradas en cada módulo.

## Recorrido de la pantalla

1. **Contexto:** el título y la descripción explican el alcance del rol autenticado. «Actualizar» vuelve a consultar el servidor.
2. **Panorama:** cinco indicadores muestran el volumen visible, propuestas abiertas, auditorías en curso, registros de riesgo alto y hallazgos abiertos.
3. **Acciones y consultas:** conserva los accesos existentes a propuestas, revisión, auditorías/riesgos y plan trimestral. Crear y revisar aparecen solo cuando el permiso correspondiente está presente en la respuesta de la API.
4. **Compromisos:** consulta por separado las acciones humanas registradas y visibles para la cuenta. Muestra cuántas siguen abiertas en su alcance, cuántas están asignadas a la cuenta y cuántas de estas últimas vencieron. Lista las tres asignadas con fecha objetivo más próxima y enlaza a Pendientes para atenderlas.
5. **Estado y riesgo:** el estado puede verse como comparación de barras o como distribución del total. El riesgo puede verse como matriz de probabilidad por impacto o como suma por nivel. Cada par de vistas reutiliza los mismos conteos recibidos; cambiar de vista no modifica datos ni filtros.
6. **Por atender:** muestra hasta ocho registros priorizados por el servidor y conserva el enlace al tablero completo. Un estado vacío se expresa en texto.

Los enlaces «Panorama», «Compromisos», «Estado y riesgo» y «Por atender» desplazan dentro de esta pantalla; la navegación de módulos sigue en el menú lateral y en la búsqueda global.

## Definiciones de los indicadores

Los indicadores del portafolio proceden de `GET /api/dashboard`, implementado en [`dashboardService.js`](../backend/services/dashboardService.js). La sección de compromisos usa además `GET /api/actions`, con filtrado de registros visibles en el servidor. El navegador solo resume los estados y fechas de las acciones ya autorizadas; no decide permisos ni amplía el alcance de lectura.

| Indicador | Significado en el contrato actual |
| --- | --- |
| Registros visibles | Propuestas y auditorías que la API incluye para la persona autenticada, en cualquier estado. |
| Pendientes de decisión / propuestas abiertas | Registros con estado `OPEN`; el rótulo «pendientes de decisión» se reserva para roles que pueden aprobar. |
| Auditorías en curso | Registros con estado `ACTIVE`. |
| Riesgo alto | Registros visibles clasificados como `Alto`, incluidos los que aún son propuestas. |
| Hallazgos abiertos | Hallazgos `OPEN` asociados a registros visibles. |
| Avance medio | Media redondeada del progreso de registros `ACTIVE` y `CLOSED`; si no existen, se muestra 0 %. |

La distribución por estado usa `statusCounts` y la matriz usa `riskMatrix` de la misma respuesta. La vista «Por nivel» suma las nueve celdas de la matriz según la clasificación existente. En ambos gráficos se muestran valores numéricos y nombres de estado; el color es una ayuda visual, no la única fuente de información. La matriz cubre auditorías activas, mientras que el indicador de riesgo alto incluye todos los registros visibles. **No deben compararse como si tuvieran el mismo universo.**

El servicio filtra las propuestas de **Auditor** por asignación. Los demás perfiles reciben el alcance definido en la API y la respuesta incluye permisos explícitos para mostrar acciones. Esta pantalla no cambia la autorización del servidor ni concede acceso por el hecho de presentar un enlace. La vista previa de otro rol disponible para Super Admin sigue siendo una función separada del menú.

Los compromisos abiertos son acciones `OPEN` o `IN_PROGRESS`; las terminadas y canceladas no se cuentan. «Asignados a mi cuenta» compara el identificador del responsable con la sesión actual. Una acción vence cuando su `dueDate` es anterior a la fecha local del navegador; no se infiere vencimiento de notificaciones leídas. Si falla la consulta de acciones, esta sección muestra el error y **no** presenta ceros como si fueran datos confirmados. Su error no oculta el resto del panel.

## Decisiones visuales y de accesibilidad

- La lectura sigue la secuencia contexto → cifras → accesos → compromisos → explicación → trabajo pendiente. Los indicadores aparecen antes de los gráficos y todas las rutas existentes permanecen visibles donde corresponden al rol.
- La retícula usa espacio consistente y una relación aproximada 1,6:1 entre panel de estado y panel de riesgo en escritorio; en móvil se apilan sin alterar la información. No se usan efectos tridimensionales en gráficos porque dificultan comparar cantidades.
- Se utilizan los tokens de [`theme.css`](../frontend/src/theme.css) en los modos Sistema, Claro, Oscuro, Contraste y FEMSA. Acentos de estado mantienen significado, incluso en la paleta FEMSA.
- Los controles de cambio de vista son botones con estado anunciado mediante `aria-pressed`; los enlaces tienen texto visible o nombre accesible. Hay objetivos táctiles de al menos 44 px en los controles nuevos de navegación y acciones.
- Los datos pueden estar cargando, fallar o estar vacíos. El refresco y los errores se anuncian; no se introduce una cifra de ejemplo ni se interpreta una ausencia como éxito.

El orden y la sencillez de los gráficos siguen las recomendaciones de [Microsoft para dashboards](https://learn.microsoft.com/en-us/power-bi/create-reports/service-dashboards-design-tips) y los [principios de dashboards del GOV.UK Design System](https://brand.design-system.service.gov.uk/data/dashboards/), adaptados al contrato real de VERA.

## Alcance de esta etapa

Esta etapa añade un resumen visual de acciones ya existentes; no cambia reglas de negocio, altera Supabase, reemplaza permisos ni afirma que una auditoría esté terminada. Antes de considerarla aceptada con datos reales, se debe contrastar el alcance de cada rol y los conteos con el entorno desplegado, según la [matriz de aceptación](hu-acceptance-audit.md).
