# Acceso y permisos

La regla vigente se obtiene de [`backend/config/roles.js`](https://github.com/humbertofigb15/VERA/blob/main/backend/config/roles.js), la ruta HTTP y las comprobaciones del recurso en el controlador o servicio. La pantalla puede ocultar una acción, pero eso **no autoriza ni protege** la API. Esta tabla resume conjuntos de roles del código; debe revisarse al cambiar una ruta.

| Acción del backend | SUPER_ADMIN | DIRECTOR | GERENTE | AUDITOR | JEFATURA |
| --- | :---: | :---: | :---: | :---: | :---: |
| Consultar usuarios | Sí | Sí | No | No | No |
| Administrar cuentas | Sí | No | No | No | No |
| Crear propuesta | Sí | No | Sí | No | Sí |
| Aprobar, iniciar, cerrar o rechazar propuesta/auditoría | Sí | No | Sí | No | No |
| Eliminar propuesta según reglas de estado | Sí | No | Sí | No | No |
| Registrar o evaluar riesgo/control | Sí | No | Sí | No | No |

**Alcance por expediente.** Estar en un conjunto de roles no garantiza acceso a cualquier registro. Por ejemplo, Auditoría ve auditorías y riesgos asignados y controles relacionados; evidencias, hallazgos, comentarios y asistente revalidan la visibilidad de la entidad. Una respuesta 404 puede ocultar la existencia de un registro ajeno.

## Flujo de identidad

- El backend verifica el JWT y el estado de la cuenta; el registro de nuevas cuentas requiere aprobación. La opción 2FA usa TOTP.
- Con usuarios persistentes, la API exige registrar el login en Supabase antes de emitir la sesión. En demo `memory`, las cuentas son de ejemplo.
- Las claves de Supabase y Azure son de servidor. Ningún valor `VITE_*` debe contener un secreto de servidor.
- El correo universitario o el acceso a Azure DevOps **no** crea automáticamente una cuenta ni una sesión de VERA.

## Cómo revisar un cambio de permisos

1. Lee [roles](https://github.com/humbertofigb15/VERA/blob/main/backend/config/roles.js), [middleware](https://github.com/humbertofigb15/VERA/tree/main/backend/middleware) y la ruta.
2. Revisa la comprobación por ID y asignación en el controlador o servicio; prueba lectura y escritura permitidas y denegadas.
3. Sincroniza el mensaje y los botones de la interfaz, y documenta la decisión. La [matriz CRUD histórica](https://github.com/humbertofigb15/VERA/blob/main/docs/permissions/hu11-crud-mapping.md) es contexto, no sustituto del código vigente.

No infieras permiso por el nombre del rol: la configuración actual excluye expresamente a `DIRECTOR` de la aprobación de propuestas y de la escritura de riesgos/controles.
