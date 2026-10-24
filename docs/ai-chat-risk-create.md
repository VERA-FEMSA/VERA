# Registro de riesgos desde la conversación

Gerente y Super Admin pueden registrar un riesgo desde una conversación guardada. El chat y el formulario usan el mismo servicio de negocio: validación de campos, evaluación inicial, autorización, deduplicación, repositorio y bitácora. Ningún texto generado por Azure OpenAI puede ordenar la escritura.

## Cómo se usa

1. Escribe `Registrar riesgo`. VERA te pide Título, Descripción, Área, Probabilidad, Impacto y Justificación, uno por línea. Puedes enviarlos junto a `Registrar riesgo` como primera línea.
2. Puedes añadir Responsable con nombre o cuenta exacta de una persona activa, Auditoría con un identificador existente y Plan con un texto de respuesta. Si omites Responsable, el registro queda a tu cargo.
3. Revisa la vista previa. VERA calcula nivel y puntaje con la misma regla del formulario. Escribe `Confirmar riesgo` dentro de cinco minutos; cualquier otra pregunta descarta la vista previa.
4. VERA registra el riesgo con una evaluación inicial y devuelve su identificador. La bitácora conserva actor y resultado.

```text
Registrar riesgo
Título: Accesos sin revisión
Descripción: Hay permisos antiguos que pueden permitir acceso indebido
Área: Operaciones
Probabilidad: 2
Impacto: 3
Justificación: Se observaron cuentas sin revisión durante el trimestre
Auditoría: AUD-01
```

Después de comprobar la vista previa, escribe `Confirmar riesgo`.

## Límites y garantías

- El formulario de campos vence a los 15 minutos; la confirmación, a los cinco. Si falta información, se deben enviar de nuevo todos los campos.
- La consulta sin historial no registra riesgos. Los otros roles no pueden registrarlos.
- La reserva del chat precede a la escritura. Un identificador de operación permite detectar reintentos; el repositorio vuelve a comprobar duplicados al confirmar.
- Las pruebas locales cubren permisos, validación, evaluación inicial, ausencia de escritura antes de confirmar y confirmaciones repetidas. La aceptación con Supabase en Production requiere evidencia independiente.
