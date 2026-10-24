# Crear propuestas de auditoría desde la conversación

La conversación guardada permite a Gerente, Jefatura y Super Admin crear una propuesta sin abandonar el asistente. Usa las mismas validaciones, permisos, repositorio y evento de auditoría que el formulario de Planificación. El modelo de lenguaje no ejecuta esta operación: el servidor reconoce campos etiquetados y los valida.

## Flujo

1. Escribe `Crear propuesta`. VERA devuelve una plantilla con Título, Objetivo, Alcance, Justificación, Área, Trimestre y Año. Puedes añadir Responsable, Tipo y Riesgo.
2. Envía los campos, uno por línea, en la conversación. También puedes enviarlos junto a `Crear propuesta` como primera línea. El responsable debe coincidir con un único Auditor activo; si se omite, queda sin asignar. Tipo predeterminado: Interna. Riesgo predeterminado: Medio.
3. VERA muestra una vista previa y no guarda nada todavía. Escribe `Confirmar propuesta` dentro de cinco minutos. Cualquier otra pregunta descarta la vista previa.
4. Tras confirmar, VERA guarda una propuesta abierta y devuelve su identificador. La conversación registra el resultado y la bitácora registra quién la creó.

La petición de campos vence a los 15 minutos. Si una validación falla, envía de nuevo todos los campos. No hay guardado parcial. La confirmación reserva la operación en el historial antes de escribirla; la operación tiene identificador propio para evitar duplicados por confirmaciones repetidas.

## Ejemplo

```text
Crear propuesta
Título: Auditoría de accesos del trimestre
Objetivo: Revisar permisos vigentes
Alcance: Aplicaciones de operaciones
Justificación: Verificar el control de accesos
Área: Operaciones
Trimestre: Q4
Año: 2026
```

Después de revisar la vista previa:

```text
Confirmar propuesta
```

## Límites y comprobación

- Director y Auditor pueden consultar expedientes, pero no crear propuestas. La consulta sin historial tampoco modifica registros.
- Este flujo crea propuestas; las decisiones y transiciones posteriores se hacen con las instrucciones descritas en [Planificación desde el chat](ai-chat-planning.md).
- Las pruebas automatizadas cubren campos requeridos, rol, ausencia de escrituras antes de confirmar, duplicación y paridad con el servicio del formulario. La validación en una base de datos o despliegue real requiere su propia evidencia de ejecución.
