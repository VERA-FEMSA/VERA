# Instrucciones para GitHub Copilot en VERA

Lee `AGENTS.md` antes de analizar o modificar el repositorio; es la fuente compartida de acuerdos. Usa `docs/ai-development/README.md` para localizar el código y preparar un PR. Si la herramienta no carga esos archivos automáticamente, ábrelos explícitamente.

- Comprueba rutas, roles, esquema y scripts en el código actual antes de afirmarlos; los documentos de HU pueden describir decisiones anteriores.
- Autoriza cada operación en el backend y según el registro visible; la protección de React no es un control de seguridad.
- Nunca envíes secretos ni datos privados al navegador, fixtures, logs o informes.
- Conserva los modos `memory` y Supabase y las migraciones; no sustituyas fallos persistentes por datos temporales.
- Explica en el PR qué verificaste realmente y qué sigue pendiente. No confundas mocks o checks de CI con aceptación en producción.
