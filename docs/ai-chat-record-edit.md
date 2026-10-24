# Edición de riesgos y controles desde el chat

Gerente y Super Admin pueden modificar campos principales de riesgos y controles existentes en una conversación guardada. El chat y los formularios usan `recordEditService`, que vuelve a comprobar cuenta, rol y las reglas de cada registro. No se otorga permiso de escritura al modelo de lenguaje.

## Formato

```text
Edita el riesgo RSK-001: nombre = «Riesgo de proveedor actualizado» porque cambió el alcance documentado.
```

Para riesgos se aceptan nombre, descripción, área y plan de respuesta. Para controles se aceptan nombre, descripción, tipo y frecuencia. Tipo utiliza `PREVENTIVE`, `DETECTIVE` o `CORRECTIVE`; frecuencia utiliza `Daily`, `Weekly`, `Monthly`, `Quarterly` o `Annually`. El ID debe ser exacto y el motivo debe tener entre 10 y 300 caracteres. El chat admite valores de hasta 650 caracteres por su límite de entrada; el formulario conserva su límite original.

La vista previa identifica el registro y muestra el valor anterior, el nuevo y el motivo. Escribe `Confirmar edición de registro` en cinco minutos. Otra pregunta descarta la vista previa. El servidor compara la fecha de modificación y el valor observados con el estado actual; en Supabase también usa la versión de almacenamiento. Si algo cambió, exige una nueva vista previa. La operación reserva el turno antes de escribir y guarda un identificador para reconocer un reintento sin repetir la edición. La bitácora conserva actor, registro, campo y motivo.

Este flujo no cambia propietario, vínculos entre registros ni resultados de evaluación. Esos cambios tienen reglas y pruebas distintas. Los roles sin gestión de riesgos y el chat sin historial reciben orientación sin modificar datos. Las pruebas locales no son aceptación autenticada de Production; ver [#226](https://github.com/VERA-GRC-IRM/VERA/issues/226).
