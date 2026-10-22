# Aceptación puntual de VERA en producción · 21 de octubre de 2026

**Corte desplegado:** `17e923c` en `main`. **Destino:** `https://www.vera-digital-systems.com/`, entorno de demostración con cuentas invitadas. La prueba local incluye la nueva prueba unitaria de este PR. Esta bitácora distingue prueba local, GitHub y lecturas o escrituras hechas en Production. No certifica todos los 78 casos del plan.

## Evidencia reproducible

| Alcance | Resultado observado | Límite |
| --- | --- | --- |
| Calidad local con Node.js 22 (`npm run quality`) | PASS en 56.16 s; 118/118 pruebas backend; 20/20 escenarios sintéticos de IA; cobertura 92.19 % líneas, 82.22 % ramas y 90.77 % funciones; 0 vulnerabilidades altas/críticas en las auditorías de dependencias. | El primer intento con Node.js 25 y sin dependencias backend falló por el entorno local; tras `npm ci --prefix backend` y Node 22, la suite pasó. |
| [Evaluación manual de IA en GitHub](https://github.com/VERA-GRC-IRM/VERA/actions/runs/39721287840) | PASS de la suite de regresión sintética y pruebas backend. | Usa respuestas simuladas; no consulta el modelo en producción. |
| Portada y acceso anónimo | HTTP 200 en `/`; HTTP 401 en `/api/assistant/status` sin sesión. | No prueba cuentas ni datos. |
| Cinco roles en Production (`scripts/verify-roles-production.ps1`) | SUPER_ADMIN, DIRECTOR, GERENTE, JEFATURA y AUDITOR iniciaron sesión y obtuvieron HTTP 200 en panel, acciones, avisos y estado/prioridades de IA. SUPER_ADMIN y DIRECTOR consultaron usuarios; los otros tres recibieron HTTP 403. El servicio indicó almacén de lectura persistente y disponibilidad de avisos de acciones. | Es una comprobación de lectura con cuentas de demostración. No cubre todas las transiciones ni todos los datos de cada rol. |
| Aislamiento de acción por registro | Una acción visible para Gerente devolvió HTTP 404 a Auditor y no apareció en sus avisos. | Se comprobó un registro concreto, no todas las combinaciones posibles. |
| Acción y aviso en Production (`scripts/verify-action-reminders-production.ps1 -Run`) | Se creó una acción sintética con fecha del día siguiente; apareció `ACTION_DUE_SOON` sin leer y con enlace correcto. La marca de lectura se conservó en una segunda sesión. Al terminar la acción, el aviso desapareció. | La acción terminada permanece en la bitácora; no se eliminó. La segunda sesión demuestra lectura persistente entre sesiones, pero no una restauración de respaldo ni una prueba tras reiniciar Supabase. |
| Asistente real con cuenta Auditor (`scripts/verify-ai-production.ps1`) | Sesión, disponibilidad Azure, prioridades por rol y respuesta de Azure OpenAI: PASS. La petición al modelo tardó 1,796 ms desde la terminal; la API informó 1,207 ms y 403/38 tokens de entrada/salida. | Auditor no tenía riesgos visibles; dato factual con cita, briefing de auditoría y consulta de evidencia privada quedaron `SKIP`. Una respuesta no mide exactitud general. |
| Tres escenarios con Azure real (`scripts/verify-ai-live-scenarios.ps1 -Run`) | PASS 3/3: riesgo ajeno y texto inyectado no se revelan; flujo de propuesta y decisión; borrador sin afirmar ejecución. Tiempos 1,553 / 2,025 / 2,650 ms; tokens de entrada 436 / 404 / 403 y de salida 42 / 86 / 173. | Es una muestra pequeña, con una sola cuenta Auditor y sin riesgos visibles. Los criterios heurísticos no demuestran ausencia general de alucinaciones o fugas. |
| Regla de fechas y permisos en código | La prueba de `notificationService` cubre vencida, hoy, séptimo día, fecha posterior, acción terminada y asignación ajena con calendario local: 3/3 pruebas del archivo. | Es evidencia unitaria; el caso real de Production anterior valida solo una fecha próxima. |

Los guiones solicitan la contraseña de forma oculta y no escriben tokens, texto de respuestas de IA, nombres de registros ni claves en archivos. Para repetir la comprobación con escritura o la evaluación de Azure se requiere el parámetro explícito `-Run`; la primera deja una acción sintética terminada, no un registro borrado. No se deben ejecutar en bucle ni contra expedientes reales de FEMSA.

## Pendientes de aceptación

- Probar con datos de demostración autorizados un riesgo y un archivo privado legible para comprobar respuesta factual con cita, lectura permitida y rechazo de acceso ajeno. Las cuentas usadas aquí no tenían riesgos visibles para Auditor.
- Comprobar manualmente en dispositivos reales el recorrido de IA y accesibilidad. Los 198 casos automatizados de navegador del [push anterior a `main`](https://github.com/VERA-GRC-IRM/VERA/actions/runs/39720000205) no sustituyen esa observación humana.
- Verificar restauración de una copia real y carga 150/250 en staging aislado. Supabase Free y la falta de un staging equivalente impiden declarar esas puertas aprobadas.
- Confirmar un valor de presupuesto y observar consumo real de Azure a lo largo del tiempo; esta prueba no demuestra un tope de gasto.

Los resultados `SKIP` y los pendientes no se convierten en aprobaciones por la existencia de documentación o checks verdes. El siguiente trabajo de producto se concentra en evaluar y mejorar la IA ya integrada, usando expedientes sintéticos conocidos y criterios de calidad medibles antes de ampliar sus capacidades.
