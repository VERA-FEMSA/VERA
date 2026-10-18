# Experiencia de acceso y apariencia

## Alcance

Las rutas públicas `/`, `/registro`, `/acerca` y `/privacidad` comparten lenguaje visual y navegación. El selector **Apariencia** está disponible también en el menú lateral de las vistas autenticadas. Esta entrega modifica presentación y estados de interacción del frontend. Los contratos de autenticación, permisos, API y esquema de datos no cambian.

VERA es un entorno de demostración. La interfaz lo indica antes del acceso y explica que las cuentas nuevas comienzan como **Auditor**; un cambio de rol exige la autorización que ya implementa el servidor. El alta por contraseña sigue sin verificar que la persona controle el correo escrito, conforme al alcance documentado en [identidad y registro](identity-rollout.md). El diseño no debe ocultar esa limitación ni sugerir una recuperación de cuenta que VERA todavía no ofrece.

## Decisiones de experiencia

| Momento | Comportamiento visible |
| --- | --- |
| Llegada | El propósito de VERA, el recorrido de información y la naturaleza de demostración se leen antes de introducir credenciales. |
| Acceso | Microsoft aparece primero, seguido de Google cuando cada proveedor está habilitado. La contraseña permanece disponible y admite gestores de contraseñas y pegado. |
| Registro | Se muestra el rol inicial, la aceptación del aviso de privacidad y la diferencia entre un proveedor externo y el correo escrito sin verificar. Las reglas de longitud se muestran cerca del campo. |
| Contraseña y segundo factor | Los controles para mostrar u ocultar son botones accesibles; el código conserva `autocomplete="one-time-code"` y acepta pegarse. No se cambia el flujo de TOTP. |
| Respuesta | Los errores se anuncian con `role="alert"`; los botones muestran que una acción está en curso para evitar envíos repetidos. |
| Navegación | Títulos por ruta, enlace para saltar al contenido público, encabezados semánticos, etiquetas explícitas y enlaces directos entre acceso, registro, producto y privacidad. |
| Apariencia | Se sigue el sistema por defecto. El usuario puede elegir Claro, Oscuro o Contraste; su elección se conserva en el navegador y se aplica antes de pintar la página. |

## Sistema visual

La paleta semántica vive en [`frontend/src/theme.css`](../frontend/src/theme.css): lienzo, superficies, texto, bordes, acento, estados y foco. Los estilos existentes conservan sus colores claros mediante `light-dark()` y toman los valores semánticos al seleccionar el tema oscuro. Las tarjetas, formularios, menús, avisos, gráficos y diálogos de los módulos se incluyen en ese mapeo. Los colores de estado de las barras permanecen distinguibles y no dependen solo del color: las vistas conservan etiquetas de texto.

El selector usa cuatro opciones nativas: **Sistema**, **Claro**, **Oscuro** y **Contraste**. Esta última usa una paleta oscura de texto y bordes más definidos, sin alterar dimensiones ni navegación. La preferencia manual se guarda solo en `localStorage`; no es un dato de perfil ni se envía al backend. Si ese almacenamiento no está disponible, el tema sigue funcionando durante la sesión. El diseño reduce transiciones cuando el sistema solicita menos movimiento.

## Vistas autenticadas

Los módulos mantienen el mismo orden, contenido, tamaños, acciones y rutas. La tipografía se hereda de la familia de sistema ya usada en la interfaz pública, en vez de cambiar a Arial al iniciar sesión; no se carga una fuente externa. Los textos secundarios que se repetían con grises demasiado tenues usan ahora un azul grisáceo más legible. Los estados intermedios conservan su significado ámbar también en oscuro. Tarjetas, tablas y filtros mantienen su estructura. El foco de teclado vuelve a ser visible en propuestas, filas de auditoría, búsqueda y selección de usuarios.

**Límite de esta entrega:** la preferencia Contraste mejora la paleta, pero no reemplaza zoom, ajustes del sistema, lector de pantalla ni una revisión humana completa. El trabajo no cambia autenticación, permisos, API ni datos.

## Criterios de revisión

- Contraste de texto normal, texto grande y controles según [WCAG 2.2, 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), en claro y oscuro.
- Foco visible, orden de tabulación, acceso por teclado, reflujo en 320 px y áreas de activación según [WCAG 2.2, 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- Etiquetas, instrucciones y errores de formularios según la [guía WAI para formularios](https://www.w3.org/WAI/tutorials/forms/) y su [guía de validación](https://www.w3.org/WAI/tutorials/forms/validation/).
- Autocompletado, gestores de contraseñas y pegado de códigos conforme a [WCAG 2.2, 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html).
- Preferencia del sistema y controles nativos de acuerdo con [MDN `color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme).

Estos son criterios de diseño y revisión, no una declaración de conformidad completa. Lint, compilación y capturas locales no sustituyen una auditoría manual con lector de pantalla, navegación por teclado de todos los módulos ni aceptación real en producción.

## Mantenimiento

Al añadir una vista, usa los tokens semánticos y comprueba ambos temas; evita nuevos colores de fondo o texto fijos. Al cambiar un formulario, preserva `label`, `autocomplete`, mensajes anunciables y el vínculo con el aviso. Al modificar una regla de identidad o permisos, actualiza primero el servidor y el [runbook de identidad](identity-rollout.md); esta guía no define autorizaciones.
