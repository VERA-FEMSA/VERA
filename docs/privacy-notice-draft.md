# Borrador de aviso de privacidad de VERA

> **En revisión. No es el aviso vigente y no debe enlazarse desde producción ni desde la pantalla OAuth.** El texto identifica las decisiones pendientes antes de recabar el consentimiento de nuevas cuentas. Última revisión del borrador: 18 de octubre de 2026.

## Responsable y alcance

Carlos Sánchez Gutiérrez es el responsable indicado para VERA. El canal propuesto para solicitudes de privacidad es [carlos.sanchez.gtz.it@gmail.com](mailto:carlos.sanchez.gtz.it@gmail.com). **Domicilio del responsable: pendiente de definir antes de publicar.**

VERA es un prototipo funcional para planificar auditorías y dar seguimiento a riesgos, controles y evidencias. El despliegue actual usa datos de demostración y cuentas invitadas; no debe cargarse información real o confidencial de FEMSA. Las cuentas nuevas requieren aprobación antes de acceder al portafolio.

## Datos y finalidades que deben declararse

| Datos | Finalidad observada en el código | Revisión pendiente |
| --- | --- | --- |
| Nombre, correo, identificador de cuenta, proveedor de identidad, estado y rol | Solicitar, verificar, aprobar y administrar el acceso | Confirmar qué datos opcionales de perfil devuelve cada proveedor y cuáles se conservan. |
| Contraseña protegida por el proveedor de identidad o hash de una cuenta anterior; factor TOTP | Autenticar la cuenta y exigir segundo factor cuando corresponda | Documentar recuperación de acceso y custodia del factor. La aplicación no debe almacenar contraseñas en claro. |
| Dirección IP, fecha/hora, resultado y actividad de acceso | Seguridad, bitácora y diagnóstico | Definir periodos de conservación de logs y supresión. |
| Contenido de demostración introducido en VERA y consultas al asistente | Mostrar expedientes de prueba y responder consultas autorizadas | Precisar categorías permitidas, retención y transferencia a Azure OpenAI. |

Las finalidades principales son operar las cuentas, limitar el acceso por permisos, registrar actividad de seguridad y prestar las funciones que la persona utiliza. No se ha identificado un envío de correo promocional en el flujo de registro. Cualquier finalidad adicional necesita revisión y comunicación antes de aplicarse.

## Servicios que participan

- **Vercel** aloja la aplicación y la API.
- **Supabase** almacena datos de la aplicación y gestiona el registro y autenticación nuevos.
- **Mailjet** transporta los correos transaccionales de verificación.
- **Google o Microsoft** intervienen solo si la persona elige uno de esos métodos de acceso; VERA solicita datos básicos de identidad y correo, no acceso a Gmail, Drive ni mensajes de Outlook.
- **Azure OpenAI** procesa las preguntas enviadas al asistente junto con el contexto que VERA autoriza para responderlas. No se debe enviar información real o confidencial al entorno de demostración.

Antes de publicar, confirmar la configuración vigente, las ubicaciones de tratamiento y las condiciones contractuales de cada servicio. El cliente de Supabase conserva una sesión en el navegador para mantener el inicio de sesión; la aplicación también usa una sesión VERA.

## Derechos y decisiones pendientes

El canal propuesto para acceso, rectificación, cancelación, oposición, limitación de uso o revocación del consentimiento es el correo indicado arriba. La solicitud no debe incluir contraseñas ni códigos. **Falta definir y documentar** la verificación de identidad, el procedimiento de respuesta y el registro de atención. No se debe prometer una eliminación automática que el software aún no ejecuta.

Para convertir este borrador en aviso público faltan:

1. Domicilio del responsable que pueda publicarse.
2. Periodos de conservación y mecanismo de supresión de cuentas, bitácoras y contenido de demostración.
3. Revisión de transferencias y encargados, incluida la ruta del asistente de IA.
4. Texto final aprobado, versión y forma de comunicar cambios.
5. Aviso simplificado en el registro y evidencia de consentimiento cuando aplique; el caso TC-77 sigue pendiente.
6. Publicar la versión aprobada en el mismo dominio de VERA, enlazarla desde la página pública y usar exactamente esa URL en Google OAuth.

## Referencias para la revisión

- [Ley Federal de Protección de Datos Personales en Posesión de los Particulares, artículos 14 a 16](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf).
- [Google Cloud: requisitos de página principal y política de privacidad para OAuth](https://support.google.com/cloud/answer/13464321?hl=en).
- [Google Cloud: página principal pública y accesible](https://support.google.com/cloud/answer/13807376?hl=en).
