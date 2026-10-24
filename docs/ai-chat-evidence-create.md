# Referencias de evidencia desde la conversación

Los roles que pueden registrar evidencias pueden hacerlo desde una conversación guardada. El chat y el formulario usan la misma validación, comprobación de acceso al registro, persistencia y bitácora. El modelo de lenguaje no ejecuta la operación.

## Flujo

1. Escribe `Registrar evidencia`. VERA pide Título, Descripción, Tipo, Referencia, Entidad e Identificador, uno por línea. Puedes incluirlos en el mismo mensaje.
2. Tipo admite `documento`, `captura`, `reporte` u `otro`. Entidad admite `riesgo`, `control` o `auditoría`. Usa el identificador exacto de un registro visible para tu cuenta.
3. Revisa la vista previa. Escribe `Confirmar evidencia` dentro de cinco minutos. Cualquier otra pregunta descarta la vista previa.
4. VERA devuelve el identificador de la evidencia y registra la relación en la bitácora.

```text
Registrar evidencia
Título: Acta de revisión
Descripción: Documento que respalda la revisión del proceso auditado
Tipo: documento
Referencia: https://ejemplo.com/acta
Entidad: auditoría
Identificador: AUD-01
```

## Límites

- Este flujo registra **referencias**, sin copiar un archivo privado. Si ya adjuntaste un archivo al chat, usa [«Vincula este archivo como evidencia»](ai-chat-file-evidence.md). No pegues enlaces que concedan acceso público a información sensible.
- La solicitud de campos vence a los 15 minutos y la vista previa a los cinco. El servidor vuelve a comprobar rol, estado de la cuenta y acceso al registro al confirmar.
- Las cuentas sin permiso de escritura y el chat sin historial no registran evidencias. Una reserva de la conversación precede a la escritura; el identificador de operación permite reconocer reintentos.
- Las pruebas locales no demuestran aceptación ni persistencia en Production; esa comprobación se sigue en [#128](https://github.com/VERA-GRC-IRM/VERA/issues/128).
