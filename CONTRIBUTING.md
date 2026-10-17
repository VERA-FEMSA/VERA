# Contribuir a VERA

VERA es un proyecto académico de equipo. Todas las personas con acceso de escritura pueden proponer cambios en cualquier módulo; esta guía define el recorrido del cambio, no asigna áreas ni responsables.

## Antes de empezar

1. Revisa [README](README.md), [AGENTS.md](AGENTS.md) y la [Wiki](https://github.com/VERA-FEMSA/VERA/wiki).
2. Si el cambio corresponde a una historia de usuario, enlaza su identificador de Azure DevOps en el PR. GitHub Issues se usa para defectos o tareas técnicas que no deban duplicar el backlog académico.
3. Crea una rama desde la versión reciente de `main`. Mantén cada PR enfocado en un resultado que pueda revisarse.

## Al proponer un cambio

- Completa la plantilla del PR: alcance, decisiones, evidencia, verificación ejecutada, duración observada y pendientes. Escribe «no ejecutado» cuando corresponda.
- Actualiza la documentación afectada. Las páginas de `docs/wiki/` son la versión revisable de la Wiki; evita editar la Wiki pública sin reflejar el mismo cambio en un PR.
- No subas credenciales, datos personales, tokens, archivos `.env` ni capturas con información privada. Usa datos sintéticos en ejemplos.
- Si modificas permisos de la aplicación, comprueba el control del servidor y el alcance de los datos, además de la visibilidad en la interfaz.
- Si modificas migraciones o variables de entorno, explica despliegue, compatibilidad y reversión.

## Integración

`main` requiere PR, una aprobación de otra persona, conversaciones resueltas y los checks de calidad, navegadores y CodeQL. Cualquier integrante con permisos puede revisar cambios de cualquier área. Los resultados de CI describen ese commit; no sustituyen la revisión funcional con datos y roles reales.

Consulta [QUALITY.md](QUALITY.md) para ejecutar las comprobaciones disponibles. No corras pruebas de carga contra producción sin una ventana coordinada.

Las actualizaciones de Dependabot también se revisan: confirma impacto de cambios mayores y no integres un PR con checks fallidos solo porque sea automático.

## Reportar problemas

Usa el formulario de GitHub Issues para defectos reproducibles sin datos sensibles. Para vulnerabilidades o claves expuestas, sigue [SECURITY.md](SECURITY.md) y usa el canal privado de GitHub.
