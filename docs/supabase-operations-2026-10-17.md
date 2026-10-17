# Estado operativo de Supabase VERA — 17 de octubre de 2026

## Alcance de la revisión

Proyecto `VERA` (`rsrsycokfdypliepcxgi`, región `us-west-2`), contrastado con `VERA-GRC-IRM/VERA` y revisado mediante el panel de Supabase y la CLI 2.121.0. No se consultaron filas de usuarios, evidencias ni secretos. Esta bitácora documenta configuración de plataforma; **no acredita pruebas funcionales de la aplicación desplegada**.

## Cambios aplicados

| Cambio | Motivo | Comprobación posterior |
| --- | --- | --- |
| Se activó la exigencia de SSL para conexiones directas a Postgres y al pooler. | La configuración anterior aceptaba conexiones sin SSL. La aplicación usa las API HTTPS de Supabase, que ya exigen TLS. | `ssl-enforcement get` devolvió `database: true`, `appliedSuccessfully: true`; el proyecto volvió a `ACTIVE_HEALTHY`. |
| Se retiró la integración GitHub con `alan-sanmiguel/VERA_demo`. | Tenía activado el despliegue de migraciones a producción desde su rama `main`, ajena al repositorio vigente. | El panel mostró `GitHub connection removed` y volvió a `Choose GitHub repository`. |

La exigencia de SSL provoca un reinicio breve de Postgres al aplicarse. No se alteraron filas, permisos SQL, políticas RLS, migraciones, claves ni el bucket de archivos. Al retirar el enlace antiguo, **no existe despliegue automático de migraciones desde GitHub**; las migraciones siguen el procedimiento manual con comparación de historial y `db push --dry-run` descrito en [la guía de persistencia](supabase-planning.md).

## Estado comprobado

| Área | Resultado | Límite de la evidencia |
| --- | --- | --- |
| Disponibilidad | Proyecto `ACTIVE_HEALTHY` después del cambio de SSL. | No equivale a una prueba de inicio de sesión o de persistencia de la aplicación. |
| Migraciones | El panel indicó `ai_feedback` como última migración. El repositorio contiene 14 archivos SQL versionados. | La comparación completa local/remota mediante la CLI no terminó porque la inicialización de la conexión SQL se bloqueó; no se afirma paridad exacta. |
| Security Advisor | 0 errores, 0 advertencias, 16 sugerencias informativas. | Varias sugerencias son tablas con RLS activado y sin políticas, coherentes con el acceso exclusivo del backend por clave de servidor; no se crearon políticas públicas para silenciarlas. |
| Performance Advisor | 0 errores, 0 advertencias, 11 sugerencias informativas sobre índices sin uso observado. | Una estadística de uso baja no justifica eliminar índices sin carga representativa. |
| Storage | `vera-evidence` privado, sin políticas públicas, límite de 3 MB y MIME PDF/PNG/JPEG/WebP/TXT. | El bucket estaba vacío en la raíz; no se probó la carga/descarga desde Vercel. |
| Configuración | El `config diff` detectó 12 diferencias `remote_only` y ninguna `update` respecto al `config.toml` mínimo. | La autenticación propia de VERA no utiliza Supabase Auth; sus ajustes remotos no se cambiaron a ciegas. |

## Riesgos y decisiones pendientes

1. **Recuperación de datos.** El proyecto está en plan Free; la página de respaldos dice que ese plan no incluye respaldos. La CLI devolvió `pitr_enabled: false` y `backups: []`. No hay punto de restauración verificado. Antes de considerar esta base apta para datos importantes, disponer de respaldos recuperables y ejecutar una restauración de prueba. Un cambio de plan genera costo; no se contrató.
2. **Clave histórica expuesta.** [GitHub mantiene abierto el aviso de secret scanning #1](https://github.com/VERA-GRC-IRM/VERA/security/secret-scanning/1) por una `supabase_secret_key` en un commit antiguo; la validez figura como `unknown`. No se imprimió ni revocó una clave sin identificar el proyecto y actualizar antes a todos los despliegues consumidores. Hay que rotarla de forma coordinada, verificar cada despliegue y cerrar el aviso con la razón correcta.
3. **Integración del repositorio vigente.** El GitHub App de Supabase no está instalado en `VERA-GRC-IRM`; la instalación solicita lectura de código y metadatos, además de escritura en Actions, checks, PR y workflows. En Free no hay ramas de vista previa automáticas. No se concedió ese acceso amplio ni se reactivó `Deploy to production` sin un respaldo recuperable y un proceso de revisión de migraciones.
4. **Mantenimiento Postgres.** El panel ofrece actualizar de 17.6.1.171 a 17.11.0.003. Se difirió: faltan respaldo y ventana de mantenimiento verificados. No es un fallo detectado por los asesores.
5. **Red de Postgres.** La lista de IP admitidas sigue en `0.0.0.0/0` y `::/0`. Se dejó intacta porque no hay un inventario validado de IP fijas para colaboradores y automatizaciones. La restricción de red se debe definir junto con todos los consumidores directos; mientras tanto, SSL está exigido y las credenciales SQL siguen siendo necesarias.
6. **Producción VERA.** No se comprobó qué despliegue de Vercel consume este proyecto ni una operación real con cuentas autorizadas después de los cambios. El estado saludable de Supabase y el CI del repositorio no sustituyen esa verificación.

## Evidencia reproducible sin secretos

```text
supabase ssl-enforcement get --project-ref rsrsycokfdypliepcxgi --experimental
{"currentConfig":{"database":true},"appliedSuccessfully":true,"message":""}

supabase backups list --project-ref rsrsycokfdypliepcxgi --experimental
{"region":"us-west-2","walg_enabled":true,"pitr_enabled":false,"backups":[],"physical_backup_data":{},"message":""}

supabase projects list --output json
VERA / rsrsycokfdypliepcxgi / ACTIVE_HEALTHY / us-west-2
```

Referencias: [SSL en Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement), [restricciones de red](https://supabase.com/docs/guides/platform/network-restrictions) y [lista de producción](https://supabase.com/docs/guides/deployment/going-into-prod).
