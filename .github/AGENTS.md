# Automatización y revisión de VERA

Aplica junto con el `AGENTS.md` de la raíz al trabajar en `.github/`.

- Conserva permisos mínimos de workflows y acciones fijadas a SHA. No ejecutes código no confiable de PR con secretos ni amplíes permisos del token para evitar un fallo de CI.
- Un check debe fallar si falla su verificación. No cambies umbrales, filtros o condiciones `if` para ocultar un resultado rojo.
- Mantén datos sensibles fuera de logs, Summary y artefactos. Diferencia pruebas deterministas sin secretos de verificaciones manuales que requieren un entorno autorizado.
- Para instrucciones de asistentes, `AGENTS.md` raíz es la fuente principal; los archivos de Copilot por ruta deben ser breves y remitir a la regla del directorio afectado.

## Code Review Rules

- Marca workflows que introduzcan secretos en eventos de PR no confiables, omitan permisos mínimos o reporten éxito cuando el paso crítico fue omitido.
