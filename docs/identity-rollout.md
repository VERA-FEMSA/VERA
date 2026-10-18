# Acceso e identidad de VERA

## Modelo acordado

El alta de una cuenta nueva no requiere autorización humana. Una cuenta nueva entra como `AUDITOR`, el rol existente con menor alcance sobre el portafolio. El cambio posterior de rol se solicita desde **Mi rol y solicitudes** y solo una cuenta `SUPER_ADMIN` puede autorizarlo o rechazarlo. Nunca se concede `SUPER_ADMIN` mediante el registro o una solicitud.

Hay tres métodos de alta: contraseña propia, Microsoft y Google. Las cuentas anteriores conservan sus contraseñas, roles, estados y factores configurados. Microsoft y Google utilizan Supabase Auth para comprobar la identidad, pero la sesión y los permisos de VERA se emiten desde el backend. Las cuentas con contraseña nueva se almacenan en `vera_users` con hash bcrypt, exigen un segundo factor TOTP en el primer acceso y no dependen del correo transaccional.

**Limitación consciente:** el alta con contraseña no verifica el control del correo indicado. Esa dirección es un identificador declarado, no una identidad comprobada; no puede servir para vincular automáticamente una cuenta previa a Google o Microsoft ni para recuperar una contraseña. Si un correo ya está ocupado, el registro devuelve conflicto. El equipo debe resolver esa colisión fuera del flujo automático tras comprobar la identidad. Supabase mantiene la confirmación de correo activada para sus propias identidades, porque desactivarla marcaría correos no comprobados como verificados y podría enlazarlos automáticamente con OAuth.

## Banderas de despliegue

| Backend | Frontend | Valor previsto | Función |
| --- | --- | --- | --- |
| `VERA_DIRECT_REGISTRATION_ENABLED` | `VITE_VERA_DIRECT_REGISTRATION_ENABLED` | `true` | Contraseña propia inmediata; sin correo ni aprobación; TOTP obligatorio al primer acceso. |
| `VERA_MANAGED_AUTH_ENABLED` | `VITE_VERA_MANAGED_AUTH_ENABLED` | `true` | Puente de identidad Supabase para OAuth. |
| `VERA_AZURE_AUTH_ENABLED` | `VITE_VERA_AZURE_AUTH_ENABLED` | `true` tras aceptación | Microsoft. |
| `VERA_GOOGLE_AUTH_ENABLED` | `VITE_VERA_GOOGLE_AUTH_ENABLED` | `true` tras aceptación | Google. |

Los flujos anteriores de código por correo y aprobación de cuentas se retiraron del registro y de la interfaz; ninguna bandera los reactiva.

Las banderas del frontend solo controlan la interfaz. El backend vuelve a comprobar el método, el estado y el rol en cada operación protegida. Nunca se publican `SUPABASE_SECRET_KEY` ni secretos OAuth como variables `VITE_*`.

Cuando una persona enlaza Microsoft y Google a la misma identidad de Supabase, `app_metadata.provider` conserva el **primer** proveedor. La marca de último acceso por identidad tampoco identifica con fiabilidad la sesión actual: Supabase puede reutilizar una sesión y no adelantar esa marca al repetir OAuth. VERA registra `OAUTH_LINKED` en esa situación, sin atribuir falsamente la entrada a Microsoft o Google; ambos proveedores deben estar habilitados en el backend para admitir la sesión vinculada. El proveedor histórico de la cuenta y el rol no se reescriben. Una nueva cuenta con identidad ya vinculada requiere revisión manual para evitar asociación accidental.

## Orden de activación

1. Confirmar que la producción usa el proyecto Supabase `rsrsycokfdypliepcxgi` y guardar los conteos de cuentas por rol y estado. Aplicar las migraciones aditivas de identidad, consentimiento, `mfa_required` y `vera_role_requests`. Verificar que las cuentas anteriores no cambian.
2. Desplegar el código con los proveedores y las altas nuevas todavía apagados. Revisar que inicio de sesión anterior, URL pública y API respondan.
3. Activar `VERA_DIRECT_REGISTRATION_ENABLED` y su par `VITE_`. Comprobar con una cuenta nueva de prueba: alta inmediata, rol Auditor, bloqueo de API antes del TOTP, activación TOTP y sesión con el factor.
4. Confirmar callbacks exactos de Microsoft y Google hacia `https://rsrsycokfdypliepcxgi.supabase.co/auth/v1/callback`, URL de retorno de VERA y secretos vigentes almacenados solo en Supabase. Activar Microsoft primero en Supabase y Vercel. Comprobar alta nueva y sesión con rol Auditor. Activar Google después con el mismo criterio.
   Antes de abrir ambos métodos, la tabla `logins` debe admitir `OAUTH_AZURE`, `OAUTH_GOOGLE` y `MANAGED_PASSWORD_TOTP`, además de los métodos anteriores. Si el registro de acceso devuelve 400, VERA bloquea la sesión; aplicar la migración `20261018203800_allow_oauth_login_methods.sql` y volver a comprobar el flujo completo.
5. Comprobar que una cuenta anterior con contraseña sigue funcionando y que usar en OAuth un correo ya registrado no toma ni eleva su cuenta. Una vinculación de identidad existente necesita un procedimiento separado que valide ambos factores; no se hace por igualdad de correo.
6. Comprobar desde una cuenta Auditor la solicitud de rol, el rechazo y la autorización con SUPER_ADMIN, la bitácora y la actualización de permisos sin recrear cuentas.

Las cuentas `PENDING` creadas por flujos anteriores no se activan automáticamente ni aparecen como nuevas solicitudes de aprobación. Requieren una conciliación individual sin alterar las cuentas activas. La tabla de solicitudes de rol es distinta del estado de cuenta.

## Compatibilidad del autenticador

Vercel ejecuta el backend con Node.js 24. `otplib` v13 debe cargarse mediante su entrada ESM: la entrada CommonJS intenta cargar una dependencia ESM y falla al generar el QR del segundo factor. El workflow de calidad ejecuta los casos de alta y TOTP también con Node.js 24 para detectar esta incompatibilidad antes de integrar cambios. Un error HTTP 500 en `/api/auth/2fa/setup` debe bloquear la activación de nuevas altas; consultar los logs de funciones de Vercel y detener temporalmente `VERA_DIRECT_REGISTRATION_ENABLED` hasta corregirlo.

## Reversión

Para detener un método nuevo, apagar sus dos banderas (backend y frontend) y redesplegar. Apagar `VERA_DIRECT_REGISTRATION_ENABLED` detiene nuevas altas con contraseña sin tocar cuentas existentes. Apagar las banderas OAuth detiene nuevas sesiones de esos proveedores; no elimina filas ni cambia roles. Mantener la migración aditiva evita que el código antiguo pierda sus datos.

## Fuentes

- [Supabase: configuración general](https://supabase.com/docs/guides/auth/general-configuration) y [vinculación de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking).
- [Supabase: Microsoft](https://supabase.com/docs/guides/auth/social-login/auth-azure) y [Google](https://supabase.com/docs/guides/auth/social-login/auth-google).
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) para contraseñas y factores.
