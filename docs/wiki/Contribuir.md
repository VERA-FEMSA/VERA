# Contribuir a VERA

Una contribución útil deja una necesidad clara, un diff acotado y evidencia reproducible. Las instrucciones de asistentes ayudan a trabajar, pero no sustituyen los criterios de la HU ni la revisión cuidadosa del cambio. El autor puede integrar su propio PR cuando las verificaciones obligatorias pasan; conviene solicitar una segunda mirada para cambios en datos, permisos o despliegue.

## Flujo de un cambio

1. Parte del `main` reciente y revisa `git status` para conservar cambios ajenos.
2. Define objetivo, criterios, roles, entidades y entorno; la [ficha de tarea](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/ai-development/task-brief.md) sirve como formato.
3. Lee [`AGENTS.md`](https://github.com/VERA-GRC-IRM/VERA/blob/main/AGENTS.md) y la guía del directorio que vas a tocar. Sigue ruta → middleware → servicio → repositorio → interfaz/prueba.
4. Haz un cambio coherente en una rama. Actualiza los contratos, pruebas y documentación afectados.
5. Ejecuta las verificaciones pertinentes y anota comandos, resultado, duración y límites. Abre un PR con la [plantilla](https://github.com/VERA-GRC-IRM/VERA/blob/main/.github/pull_request_template.md).
6. Revisa diff, checks y comentarios antes de fusionar. Un check verde no reemplaza una revisión de permisos o de datos.

La [guía de desarrollo con IA](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/ai-development/README.md) explica cómo usar Codex, Claude Code, Copilot y un chat genérico sin presentar las instrucciones como entrenamiento del modelo. La [comprobación de preparación](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/ai-development/agent-readiness.md) ayuda a detectar lecturas erróneas del repositorio antes de pedir una edición.

## Cómo mantener esta Wiki

La Wiki es un [repositorio Git independiente](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages). Conserva historial, pero sus cambios no pasan por los checks del PR de código. La versión revisable de estas páginas vive en [`docs/wiki/`](https://github.com/VERA-GRC-IRM/VERA/tree/main/docs/wiki): prepara allí los cambios y fusiónalos por PR. El workflow `Publicar Wiki desde main` sincroniza las páginas tras ese merge; revisa su corrida y los enlaces. Una edición directa en la Wiki puede quedar sobrescrita por la próxima sincronización. Mantén en la página enlaces al código o al runbook de `main`, evita copiar secretos o datos personales y actualiza la fecha cuando describas un estado puntual.

**Jerarquía de evidencia:** criterio aprobado → código y configuración del commit → prueba ejecutada → despliegue verificado → aceptación. Si la Wiki y el código divergen, informa la discrepancia con ruta y commit; no amplíes permisos para hacer coincidir una explicación antigua.
