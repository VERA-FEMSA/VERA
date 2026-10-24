# Registro de hallazgos desde la conversación

Gerente y Super Admin pueden registrar hallazgos de controles inefectivos. Auditor puede hacerlo sólo cuando el riesgo vinculado está a su cargo. El chat y el formulario usan el mismo servicio de negocio para validar control, riesgo, permiso, evaluación y duplicados; el modelo de lenguaje no ejecuta la escritura.

## Flujo

1. Escribe `Registrar hallazgo` en una conversación guardada. VERA pide Título, Descripción, Control y Riesgo, uno por línea. También puedes incluirlos después de la primera línea `Registrar hallazgo`.
2. Indica identificadores exactos o títulos únicos. El control debe estar asociado al riesgo y tener efectividad 1–3. El Auditor debe ser el responsable del riesgo.
3. Revisa la vista previa con la evaluación del control y la auditoría vinculada. Escribe `Confirmar hallazgo` dentro de cinco minutos. Si cambia la evaluación antes de confirmar, la operación se rechaza y debes generar otra vista previa.
4. VERA registra un hallazgo abierto y devuelve su identificador. El expediente y la bitácora conservan la relación con control, riesgo y auditoría.

```text
Registrar hallazgo
Título: Revisión de accesos incompleta
Descripción: El control no cubrió todos los accesos y requiere seguimiento
Control: CTL-001
Riesgo: RSK-001
```

## Límites

- El formulario de campos vence a los 15 minutos y la vista previa a los cinco. Una pregunta distinta descarta la confirmación pendiente.
- La ruta sin historial y los roles sin permiso no crean hallazgos. El servidor vuelve a validar la cuenta y la relación al confirmar.
- Se permite un hallazgo por riesgo y versión de evaluación de control. Una operación reservada usa identificador para reconocer un reintento.
- Las pruebas locales cubren permisos, ausencia de escritura antes de confirmar, cambio de evaluación y confirmaciones simultáneas. La aceptación con Supabase en Production requiere evidencia independiente.
