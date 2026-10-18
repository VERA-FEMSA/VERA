# Registro abierto y acceso federado de VERA

## Contrato de acceso

Esta entrega agrega un camino **optativo y apagado por defecto** para cuentas nuevas. El acceso tradicional, los hashes, los roles, los estados y el 2FA actual de todas las cuentas existentes permanecen intactos. No se enlaza automáticamente una identidad Google o Microsoft a una cuenta VERA anterior que tenga el mismo correo. Las cuentas nuevas, sin importar el proveedor, empiezan en `PENDING` y necesitan aprobación; ningún proveedor otorga `SUPER_ADMIN` por sí mismo.

| Cuenta | Comprobación de correo | Segundo factor | Aprobación VERA |
| --- | --- | --- | --- |
| Existente | Sin cambios | Sin cambios | Sin cambios |
| Nueva con contraseña | Código de confirmación por correo | TOTP obligatorio antes de emitir sesión VERA | Sí |
| Nueva con Google o Microsoft | Identidad y correo verificados por el proveedor | Depende del proveedor | Sí |

El correo comprueba la dirección; **no se presenta como segundo factor NIST**. NIST SP 800-63B-4 prohíbe usar correo como autenticador fuera de banda. Por eso la contraseña propia usa TOTP de una app de autenticación. Para contraseñas nuevas se exigen 15–128 caracteres Unicode normalizados a NFC, sin reglas de mayúsculas/símbolos, y se rechazan las encontradas en la lista de Pwned Passwords consultada por rango de hash. Si esa consulta falla, el registro se detiene; ningún secreto completo se envía al servicio. Las contraseñas existentes no se reevalúan ni se alteran.

## Secuencia de activación

1. Mantener `VERA_MANAGED_AUTH_ENABLED=false` y `VITE_VERA_MANAGED_AUTH_ENABLED=false` durante la preparación; dejar también apagadas las banderas de Google y Microsoft. Desplegar el código así preserva la consulta anterior de `vera_users`.
2. Revisar la migración `20261018120000_add_managed_auth_identity.sql` frente al proyecto Supabase correcto. Solo añade columnas opcionales e índice único; no actualiza cuentas existentes. Aplicarla antes de activar banderas. Comprobar que el número de cuentas y sus roles/estados no cambió.
3. Configurar **SMTP propio** en Supabase Auth. El SMTP gratuito predeterminado de Supabase solo entrega a miembros autorizados del proyecto y no sirve para registrar cualquier dominio. Verificar DNS de un subdominio de envío, SPF/DKIM y entregabilidad. En `Confirm sign up` usar una plantilla con `{{ .Token }}` para que VERA pueda verificar el código en pantalla. Mantener `Confirm email` activado.
4. Configurar la URL principal `https://www.vera-digital-systems.com` y las redirecciones exactas necesarias en Supabase Auth. No añadir comodines de Preview a producción.
5. Configurar el proveedor Google con cliente OAuth Web y su callback de Supabase; configurar Microsoft como aplicación multitenant y de cuentas personales si esa es la audiencia deseada. Incluir la reclamación `xms_edov` en Microsoft para tratar correos verificados. Restringir ambos proveedores a datos básicos de perfil/correo.
6. Configurar solo en **backend** `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `VERA_USER_STORE=supabase` y `VERA_MANAGED_AUTH_ENABLED=true`. El secreto nunca se publica como `VITE_*`. Configurar en **frontend** solo `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VERA_MANAGED_AUTH_ENABLED=true`; activar las banderas Google/Azure de cada lado únicamente cuando ese proveedor esté preparado.
7. Validar una cuenta nueva con correo externo: registro → código recibido → aprobación → contraseña → TOTP → sesión. Validar Google y Microsoft con cuentas **nuevas**; confirmar que quedan pendientes y que no heredan una cuenta existente por correo. Validar inicio de sesión de una cuenta anterior sin cambios. No usar cuentas reales del equipo como fixtures.

Si un proveedor, correo o migración no está listo, mantener su bandera apagada. El cambio de código por sí solo **no acredita** entrega de correo ni funcionamiento de OAuth en producción.

## Operación y reversión

- El backend valida la sesión de Supabase Auth con `/auth/v1/user` y solo después emite la sesión VERA. También vuelve a leer estado y rol de `vera_users` en cada API protegida. Una cuenta `PENDING` o `DISABLED` nunca recibe sesión VERA.
- El registro propio solo crea la fila VERA a través del backend, después de revisar la contraseña. Un registro directo en Supabase Auth no crea acceso VERA. Los identificadores externos se almacenan en columnas opcionales y únicas.
- Si falla el envío de correo o la comprobación de contraseñas filtradas, no se permite completar un registro nuevo. Revisar logs sin imprimir códigos, contraseñas, tokens ni claves.
- Para detener registros nuevos, apagar `VERA_MANAGED_AUTH_ENABLED` y `VITE_VERA_MANAGED_AUTH_ENABLED` y redesplegar. Esto conserva las cuentas y la migración; las cuentas antiguas siguen en su camino tradicional. Las cuentas nuevas gestionadas no podrán iniciar sesión mientras la función esté desactivada.
- No borrar identidades de Supabase Auth ni filas `vera_users` para revertir. Conciliar de forma explícita cualquier alta interrumpida entre GoTrue y `vera_users` antes de reintentar el correo.

## Fuentes de la política

- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html): longitud, bloqueo de contraseñas filtradas y prohibición de correo como segundo factor.
- [Supabase Auth: SMTP propio](https://supabase.com/docs/guides/auth/auth-smtp), [plantillas y código](https://supabase.com/docs/guides/auth/auth-email-templates), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Microsoft](https://supabase.com/docs/guides/auth/social-login/auth-azure) y [MFA](https://supabase.com/docs/guides/auth/auth-mfa).
- [Pwned Passwords API](https://haveibeenpwned.com/API/v3): consulta por prefijo SHA-1 de cinco caracteres con padding.
