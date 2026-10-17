# Contribuir a VERA

Una contribución útil deja una necesidad clara, un diff acotado y evidencia reproducible. Las instrucciones de asistentes ayudan a trabajar, pero no sustituyen los criterios de la HU ni la revisión de otra persona.

## Flujo de un cambio

1. Parte del `main` reciente y revisa `git status` para conservar cambios ajenos.
2. Define objetivo, criterios, roles, entidades y entorno; la [ficha de tarea](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-development/task-brief.md) sirve como formato.
3. Lee [`AGENTS.md`](https://github.com/humbertofigb15/VERA/blob/main/AGENTS.md) y la guía del directorio que vas a tocar. Sigue ruta → middleware → servicio → repositorio → interfaz/prueba.
4. Haz un cambio coherente en una rama. Actualiza los contratos, pruebas y documentación afectados.
5. Ejecuta las verificaciones pertinentes y anota comandos, resultado, duración y límites. Abre un PR con la [plantilla](https://github.com/humbertofigb15/VERA/blob/main/.github/pull_request_template.md).
6. Revisa diff, checks y comentarios antes de fusionar. Un check verde no reemplaza una revisión de permisos o de datos.

La [guía de desarrollo con IA](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-development/README.md) explica cómo usar Codex, Claude Code, Copilot y un chat genérico sin presentar las instrucciones como entrenamiento del modelo. La [comprobación de preparación](https://github.com/humbertofigb15/VERA/blob/main/docs/ai-development/agent-readiness.md) ayuda a detectar lecturas erróneas del repositorio antes de pedir una edición.

## Cómo mantener esta base de conocimiento

La fuente revisable vive en [`docs/wiki/`](https://github.com/humbertofigb15/VERA/tree/main/docs/wiki). La Wiki nativa de GitHub será un [repositorio Git independiente](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages) cuando se inicialice. Sus cambios directos no pasan por los checks del PR de código: prepara cambios importantes en esta carpeta, fusiona el PR y luego publica el espejo. Mantén enlaces al código o runbook de `main`; no copies secretos ni datos personales.

Antes de publicar por terminal, una persona con acceso de escritura debe crear y guardar la primera página `Home` en la pestaña Wiki. GitHub todavía no expone `.wiki.git` antes de ese paso. Después se clona la Wiki y se copian las páginas de `docs/wiki/`, cambiando los enlaces internos del espejo a URLs de la Wiki nativa. No sobrescribas cambios realizados directamente en la Wiki sin revisarlos primero.

**Jerarquía de evidencia:** criterio aprobado → código y configuración del commit → prueba ejecutada → despliegue verificado → aceptación. Si la Wiki y el código divergen, informa la discrepancia con ruta y commit; no amplíes permisos para hacer coincidir una explicación antigua.
