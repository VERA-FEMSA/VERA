# Registro de controles desde la conversación

Gerente y Super Admin pueden registrar un control desde una conversación guardada. El chat y el formulario comparten validación, permisos, repositorio, evaluación inicial y bitácora. El modelo de lenguaje no ejecuta la operación.

## Flujo

1. Escribe `Registrar control`. VERA pide Título, Descripción, Tipo, Frecuencia, Riesgos, Efectividad y Justificación, uno por línea. Puedes incluirlos en el mismo mensaje debajo de `Registrar control`.
2. Indica uno o más riesgos por identificador exacto o título único, separados por comas. El responsable es opcional; si se omite, queda a tu cargo. Tipo admite Preventivo, Detectivo o Correctivo; frecuencia admite Diaria, Semanal, Mensual, Trimestral o Anual.
3. Revisa la vista previa con los riesgos relacionados, el responsable y la efectividad inicial. Escribe `Confirmar control nuevo` dentro de cinco minutos. Cualquier otra pregunta descarta esa vista previa.
4. VERA devuelve el identificador del control y registra la creación en la bitácora.

```text
Registrar control
Título: Revisión mensual de accesos
Descripción: El responsable comprueba permisos activos y documenta excepciones
Tipo: Preventivo
Frecuencia: Mensual
Riesgos: RSK-001
Efectividad: 4
Justificación: La revisión cubre todos los accesos del periodo
```

## Límites

- La solicitud de campos vence a los 15 minutos y la vista previa a los cinco. Si falta información, envía todos los campos otra vez.
- Debe existir por lo menos un riesgo. Si un nombre es ambiguo, VERA pide su identificador. La creación permite hasta diez riesgos por instrucción.
- Los roles de consulta y la ruta sin historial no registran controles. El servidor revisa de nuevo el rol y los riesgos al confirmar.
- La reserva del chat precede a la escritura y un identificador de operación ayuda a evitar la duplicación por reintentos. La aceptación con Supabase en Production necesita evidencia aparte de las pruebas locales.
