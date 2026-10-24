# Comentarios de auditoría desde la conversación

Los roles con permiso de escritura pueden agregar comentarios a propuestas y auditorías visibles sin salir del chat. El formulario y la conversación usan el mismo servicio para comprobar cuenta, rol, expediente y longitud del texto, persistir y registrar el evento en la bitácora. El modelo de lenguaje no ejecuta el comentario.

## Flujo

1. Escribe `Comenta la auditoría AUD-01: La revisión quedó documentada en el expediente.` Sustituye `AUD-01` por el identificador exacto de una propuesta o auditoría visible.
2. Revisa la vista previa del expediente y del texto. Escribe `Confirmar comentario` dentro de cinco minutos. Cualquier otra pregunta descarta la vista previa.
3. VERA devuelve el identificador del comentario; queda disponible en el historial del expediente.

## Límites

- El chat acepta una instrucción de hasta 800 caracteres. El formulario conserva su límite de 2,000 caracteres para el cuerpo del comentario.
- Director y la ruta sin historial no pueden escribir. Un Auditor solo puede comentar los expedientes que tiene asignados. El servidor vuelve a comprobar el acceso al confirmar.
- La conversación se reserva antes de escribir y el identificador de operación permite reconocer reintentos sin agregar un segundo comentario. No cambia el esquema de Supabase: el identificador queda en el JSON del comentario.
- Las pruebas locales no acreditan persistencia ni permisos en Production; la aceptación se sigue en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128).
