# Experiencia de acceso y apariencia

## Alcance

Las páginas públicas de producto ahora tienen una [guía de navegación, contenido y diseño](public-product-site.md). **Plataforma**, **Soluciones** y **Confianza** explican VERA desde el negocio; **Tecnología** reúne las fuentes de ingeniería y calidad en una posición secundaria del encabezado. El inicio de sesión permanece en `/`.

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
| Navegación | Títulos por ruta, enlace para saltar al contenido público, encabezados semánticos, etiquetas explícitas y enlaces directos entre acceso, registro, producto y privacidad. Dentro de la aplicación, el menú se agrupa por tarea y se puede contraer en escritorio. |
| Búsqueda global | La barra superior encuentra módulos, vistas previas de rol, Apariencia, Cerrar sesión y controles visibles de la pantalla actual. Al elegir un control de la pantalla, lo enfoca sin ejecutar la acción. |
| Apariencia | FEMSA es la presentación inicial al abrir cualquier ruta en un navegador sin preferencia guardada, incluso desde un enlace compartido. El usuario puede elegir Sistema, Claro, Oscuro o Contraste; su elección se conserva en el navegador y se aplica antes de pintar la página. |
| Entrada visual | Un velo verde VERA translúcido y desenfocado, con el logo nítido al centro, recibe una luz roja FEMSA y se disuelve en un segundo al cargar la página y después de autenticar. No retrasa la navegación ni impide interactuar; se omite si el sistema pide movimiento reducido. |

## Sistema visual

La paleta semántica vive en [`frontend/src/theme.css`](../frontend/src/theme.css): lienzo, superficies, texto, bordes, acento, estados y foco. Los estilos existentes conservan sus colores claros mediante `light-dark()` y toman los valores semánticos al seleccionar el tema oscuro. Las tarjetas, formularios, menús, avisos, gráficos y diálogos de los módulos se incluyen en ese mapeo. Los colores de estado de las barras permanecen distinguibles y no dependen solo del color: las vistas conservan etiquetas de texto.

El selector usa cinco opciones nativas: **Sistema**, **Claro**, **Oscuro**, **Contraste** y **FEMSA**. FEMSA es el valor inicial en un navegador sin preferencia guardada; una elección manual, incluida Sistema, prevalece después sin depender del rol o de la ruta. Contraste usa una paleta oscura de texto y bordes más definidos. FEMSA emplea superficies neutras y el rojo `#BF4246` documentado en su [guía pública de identidad](https://identidad.femsa.com/wp-content/uploads/2022/04/Gui%CC%81a-de-uso-03.pdf) para el acento principal. Es una opción visual contextual; no afirma una certificación de identidad corporativa. El logotipo VERA y los colores semánticos de estado conservan su significado. La preferencia manual se guarda solo en `localStorage`; no es un dato de perfil ni se envía al backend. Si ese almacenamiento no está disponible, FEMSA se aplica durante la sesión. El diseño reduce transiciones cuando el sistema solicita menos movimiento.

## Vistas autenticadas

La primera pantalla, **Panel de Portafolio**, tiene una [guía propia de lectura y diseño](portfolio-dashboard.md): explica la jerarquía de indicadores, las dos vistas de estado, las dos vistas de riesgo, el alcance por rol y los límites de interpretación de las cifras.

Los contenidos, acciones, rutas, permisos y estructura de cada pantalla se mantienen. La navegación lateral ahora agrupa los mismos módulos en **Portafolio y auditorías**, **Riesgos y evidencia**, **Seguimiento**, **Asistencia** y **Cuenta y administración**. El acceso de Super Admin a las cuatro vistas previas de rol sigue disponible, ahora dentro de la zona desplazable del menú. En escritorio se puede contraer a una barra de iconos con nombres accesibles y se recuerda la elección en el navegador; en móvil aparece como panel completo con cierre, bloqueo de foco y tecla Escape. La barra de búsqueda global permanece en la parte superior, permite `Ctrl/Cmd + K`, búsqueda sin acentos y navegación por teclado.

La búsqueda presenta exclusivamente las secciones que el menú ya muestra al rol actual. También localiza botones y enlaces visibles de la pantalla abierta: al seleccionarlos desplaza y enfoca el control, sin pulsarlo. No consulta datos, archivos ni funciones ocultas; tampoco amplía los permisos del usuario. Las acciones como cerrar sesión conservan una etiqueta explícita antes de ejecutarse.

La tipografía se hereda de la familia de sistema ya usada en la interfaz pública, en vez de cambiar a Arial al iniciar sesión; no se carga una fuente externa. Los textos secundarios que se repetían con grises demasiado tenues usan ahora un azul grisáceo más legible. Los estados intermedios conservan su significado ámbar también en oscuro. Tarjetas, tablas y filtros mantienen su estructura. El foco de teclado vuelve a ser visible en propuestas, filas de auditoría, búsqueda y selección de usuarios.

El patrón de menú persistente, agrupación y colapso toma como referencia las guías de [IBM Carbon](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-left-panel/specifications), [Microsoft Fluent](https://fluent2.microsoft.design/components/web/react/core/nav/usage/) y la organización de módulos de [Snowflake](https://docs.snowflake.com/en/user-guide/ui-snowsight-navigation). Se adaptó a las tareas y permisos de VERA; no se copió la interfaz de un producto externo.

**Límite de esta entrega:** las preferencias Contraste y FEMSA cambian la paleta, pero no reemplazan zoom, ajustes del sistema, lector de pantalla ni una revisión humana completa. El trabajo no cambia autenticación, permisos, API ni datos.

## Criterios de revisión

- Contraste de texto normal, texto grande y controles según [WCAG 2.2, 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), en claro y oscuro.
- Foco visible, orden de tabulación, acceso por teclado, reflujo en 320 px y áreas de activación según [WCAG 2.2, 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- Etiquetas, instrucciones y errores de formularios según la [guía WAI para formularios](https://www.w3.org/WAI/tutorials/forms/) y su [guía de validación](https://www.w3.org/WAI/tutorials/forms/validation/).
- Autocompletado, gestores de contraseñas y pegado de códigos conforme a [WCAG 2.2, 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html).
- Preferencia del sistema y controles nativos de acuerdo con [MDN `color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme).

Estos son criterios de diseño y revisión, no una declaración de conformidad completa. Lint, compilación y capturas locales no sustituyen una auditoría manual con lector de pantalla, navegación por teclado de todos los módulos ni aceptación real en producción.

## Mantenimiento

Al añadir una vista, usa los tokens semánticos y revisa los cinco modos de Apariencia; evita nuevos colores de fondo o texto fijos. Registra una nueva ruta en el grupo adecuado del menú para que aparezca también en la búsqueda; las acciones de la pantalla se descubren al abrir la búsqueda. Al cambiar un formulario, preserva `label`, `autocomplete`, mensajes anunciables y el vínculo con el aviso. Al modificar una regla de identidad o permisos, actualiza primero el servidor y el [runbook de identidad](identity-rollout.md); esta guía no define autorizaciones.
