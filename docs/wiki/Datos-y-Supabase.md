# Datos y Supabase

VERA tiene seis modos de almacén. La plantilla [`.env.example`](https://github.com/humbertofigb15/VERA/blob/main/.env.example) usa `memory` por defecto para la demo. Los modos `supabase` requieren esquema, secretos del backend, dependencias entre dominios y una verificación en el entorno correspondiente. [`storeModes.js`](https://github.com/humbertofigb15/VERA/blob/main/backend/config/storeModes.js) rechaza combinaciones incompletas.

| Variable | Dominio | Dependencia al activar Supabase |
| --- | --- | --- |
| `VERA_USER_STORE` | Cuentas y login | Migraciones y configuración de usuarios. |
| `VERA_PLANNING_STORE` | Propuestas y auditorías | Migraciones de planificación. |
| `VERA_RISK_CONTROL_STORE` | Riesgos, controles y hallazgos | Usuarios **y** planificación persistentes. |
| `VERA_EVIDENCE_COMMENT_STORE` | Evidencias y comentarios | Usuarios, planificación, riesgos y controles persistentes. |
| `VERA_NOTIFICATION_STORE` | Marcas de lectura | Usuarios y planificación persistentes. |
| `VERA_AUDIT_STORE` | Bitácora general | Los demás almacenes persistentes requeridos por la validación. |

## Migraciones y archivos

Las [migraciones versionadas](https://github.com/humbertofigb15/VERA/tree/main/supabase/migrations) definen esquema y políticas de acceso. La guía de [activación de Supabase](https://github.com/humbertofigb15/VERA/blob/main/docs/supabase-planning.md) documenta orden, conciliación con datos existentes y verificaciones. La décima migración crea el bucket privado de evidencia; la undécima agrega lecturas de notificaciones.

Los archivos admitidos por la ruta de carga son PDF, PNG, JPEG, WebP y TXT de hasta 3 MB. El backend comprueba acceso a la entidad antes de cargar y antes de entregar una URL temporal de descarga. Metadatos en `memory` pueden perderse al reiniciar aunque el objeto permanezca en Storage; por eso la configuración de ambos lados debe verificarse junta.

## Qué prueba la persistencia real

1. Anota el entorno y el SHA publicado, sin copiar claves.
2. Crea un registro sintético autorizado; conserva su ID y estado.
3. Reinicia o redespliega el backend y consulta con la misma cuenta y otra cuenta con distinto permiso.
4. Confirma el mismo ID/estado, la negativa de acceso ajeno y los eventos esperados. Registra fecha, resultado y limitaciones.

Una suite con adaptadores simulados, una migración aplicada o un despliegue `READY` no completan esos pasos. El [runbook operativo](https://github.com/humbertofigb15/VERA/blob/main/docs/testing/operations-runbook.md) conserva la secuencia de comprobación.
