# Feedback y calidad operativa del asistente

VERA permite valorar cada respuesta del chat con **Sí** o **No**. La valoración se registra una vez por respuesta y no incluye la pregunta, el texto de la respuesta, archivos ni identificadores de usuario en la tabla. El navegador envía un token firmado de interacción y la calificación. El servidor comprueba que el token pertenece a la cuenta autenticada y caduca a las 24 horas.

La cuenta `SUPER_ADMIN` dispone de **Asistencia → Calidad de IA** (`/calidad-ia`). La vista muestra el periodo de 30 días, hora de consulta, respuestas valoradas, votos positivos y negativos, porcentaje positivo y desglose por modo. Incluye estados vacío, error y actualización manual. Si el resumen llega al límite de 10 000 filas, avisa que es parcial. Los otros roles no ven la opción; el backend también rechaza la lectura con `403`.

## Contrato

- `POST /api/assistant/feedback` requiere sesión, `feedbackToken` firmado y `rating` igual a `helpful` o `unhelpful`. Repetir el mismo token devuelve `409`.
- `GET /api/assistant/quality` exige `SUPER_ADMIN` y devuelve solo agregados de los últimos 30 días: total, positivos, negativos, porcentaje positivo y desglose por modo (`computed`, `generated`, `document-search`, etc.). La respuesta marca `partial` cuando la consulta llega al límite de 10 000 filas.
- La migración `20261017020000_ai_feedback.sql` crea `vera_ai_feedback` con acceso exclusivo del `service_role`. Se aplicó y confirmó en el proyecto Supabase VERA el 17 de octubre de 2026. En despliegues con `VERA_USER_STORE=supabase`, VERA almacena las valoraciones en Supabase; localmente usa memoria para pruebas.
- Los endpoints tienen límite por sesión y `Cache-Control: no-store`. Los logs registran canal, modo y calificación, nunca conversación ni token.

## Lectura SRE

El porcentaje positivo mide **opinión de quienes eligieron valorar**, no exactitud factual ni satisfacción de toda la población. Acompañarlo con número de respuestas valoradas, resultados del evaluador sintético (`npm run ai:eval` con Azure configurado), errores `VERA_AI_ERROR`, latencia `durationMs` y uso de tokens ya emitidos en logs. Una caída del porcentaje o un aumento de respuestas sin cita requiere investigar los expedientes y repetir casos de aceptación por rol.

Consulta desde PowerShell con una sesión autorizada de `SUPER_ADMIN`:

```powershell
$base = "https://TU-DESPLIEGUE"
$token = "TOKEN_DE_SESION_SUPER_ADMIN"
Invoke-RestMethod -Uri "$base/api/assistant/quality" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 6
```

No pegues el token ni su salida en un PR o captura compartida. La aceptación en producción necesita dos cuentas reales y figura en [ai-production-acceptance.md](ai-production-acceptance.md).
