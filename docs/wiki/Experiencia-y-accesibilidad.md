# Experiencia y accesibilidad

VERA presenta antes del acceso qué hace la plataforma y que el entorno público contiene datos de demostración. [Plataforma](https://www.vera-digital-systems.com/acerca), [Soluciones](https://www.vera-digital-systems.com/soluciones), [Confianza](https://www.vera-digital-systems.com/confianza) y [Tecnología](https://www.vera-digital-systems.com/tecnologia) son los cuatro recorridos públicos; el último reúne código, Wiki y evidencia de calidad. [Iniciar sesión](https://www.vera-digital-systems.com/), [crear cuenta](https://www.vera-digital-systems.com/registro) y [leer el aviso de privacidad](https://www.vera-digital-systems.com/privacidad) siguen siendo rutas directas.

Microsoft, Google y contraseña aparecen según la configuración vigente. La interfaz informa que una cuenta nueva comienza como **Auditor** y que pedir otro rol requiere autorización. El registro por contraseña no verifica la titularidad del correo: consulta la [guía de identidad](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/identity-rollout.md) antes de usar un correo nuevo.

## Apariencia

El selector **Apariencia** permite usar el tema del sistema, Claro, Oscuro, Contraste o FEMSA. Está en las páginas públicas y en el menú lateral de la aplicación. La preferencia se conserva en este navegador; no cambia permisos ni datos. El modo oscuro abarca tarjetas, formularios, navegación, avisos y diálogos de los módulos. Contraste refuerza texto, bordes y foco sobre una base oscura. FEMSA usa un acento rojo de su guía pública de identidad sobre superficies neutras, conservando el logotipo y los estados semánticos de VERA.

En las vistas posteriores al acceso se conserva la estructura de cada pantalla. El menú lateral reúne las mismas opciones en grupos por tarea y puede contraerse en escritorio; en móvil se abre como panel completo y se cierra con Escape. La barra superior permite buscar módulos y localizar controles visibles de la pantalla con `Ctrl/Cmd + K`. Localizar un control lo enfoca sin ejecutar la acción. Las vistas previas de rol de Super Admin y todos los enlaces originales siguen disponibles. Se unificó la tipografía con el resto de la aplicación, se hicieron más legibles los textos secundarios y se corrigió el color de los estados intermedios en oscuro. Se reforzó el foco visible de las tarjetas de propuestas, filas de auditoría, filtros y controles de usuarios.

El [Panel de Portafolio](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/portfolio-dashboard.md) ordena la primera lectura por contexto, indicadores, acciones, estado, riesgo y pendientes. Sus gráficos permiten comparar estados o ver su distribución, y alternar entre matriz de riesgo y conteos por nivel con los mismos datos del servidor. Conserva enlaces y acciones por rol, y documenta el significado y alcance de cada cifra.

## Diseño y límites

La [guía técnica de experiencia](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/ui-experience.md) reúne las decisiones de formularios, teclado, foco, legibilidad y contraste, con referencias a WCAG 2.2 y WAI. Describe criterios de revisión; no certifica por sí sola conformidad de accesibilidad ni la aceptación funcional en producción.
