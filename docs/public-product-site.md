# Sitio público de producto

## Propósito y navegación

Las rutas públicas de VERA presentan el producto antes de iniciar sesión. El encabezado mantiene cuatro decisiones de navegación: **Plataforma** (`/acerca`) explica la propuesta de valor; **Soluciones** (`/soluciones`) parte de preguntas de dirección, planeación y auditoría; **Confianza** (`/confianza`) explica alcance por rol, decisiones y trazabilidad; **Tecnología** (`/tecnologia`) queda a la derecha con la implementación y evidencia. **Acceder a VERA** lleva al inicio de sesión. El aviso de privacidad permanece accesible desde el pie de todas las páginas públicas.

El inicio de sesión y el registro muestran esas mismas cuatro rutas directamente en su encabezado, junto al acceso a privacidad y el selector de apariencia. En pantallas estrechas, los enlaces ocupan una fila compacta visible sin abrir un menú; los nombres y destinos provienen de una sola lista compartida con el sitio público.

La portada nombra el tipo de plataforma en una frase antes de profundizar en beneficios. El enlace de acceso aclara que hace falta una cuenta y ofrece el registro. Bajo el primer bloque se muestra una vista del panel actual y se puede abrir la captura completa; junto a ella aparecen enlaces directos al repositorio, la Wiki y el portal de calidad.

El [tráiler de VERA](https://www.youtube.com/shorts/X2RuivSwSVo) aparece en `/acerca#trailer-vera`, después de la vista del producto. Su marco vertical respeta el formato original del video y los tokens de apariencia del sitio. El reproductor de YouTube solo se crea al pulsar **Reproducir tráiler**; **Cerrar video** lo retira y detiene la reproducción. Hay un enlace directo al video original si el reproductor externo no está disponible. README y Wiki enlazan tanto al original como a esta sección. El video es material de presentación, no evidencia de aceptación funcional.

El inicio de sesión muestra un QR estático que abre la URL canónica `https://www.vera-digital-systems.com/` y un acceso discreto al mismo tráiler. En escritorio están junto a la introducción, a la vista sin desplazar la página en una pantalla habitual: al pulsar el QR pequeño se abre uno de 300 px para escanearlo, sin redirigir el navegador de escritorio. En móvil aparecen dos acciones compactas cerca del título. El QR ampliado y el video se abren en ventanas accesibles que pueden cerrarse con Escape; el enlace directo queda dentro de la ventana como alternativa. El reproductor se carga solamente al solicitar el video y se destruye al cerrar la ventana. El QR es de navegación: no contiene credenciales, no autentica y no sustituye el QR de configuración del doble factor. Quien abra por primera vez el enlace compartido verá la apariencia FEMSA; si ya eligió otra apariencia en ese navegador, se respeta.

Al cargar una página completa aparece una transición de 620 ms: el logotipo VERA sobre verde sobrio, una expansión hacia el rojo FEMSA y un desvanecimiento que deja ver el contenido. Al completar el inicio de sesión, se reproduce la misma transición mientras la navegación al panel continúa de inmediato. Es puramente decorativa, no captura clics ni altera la sesión; con movimiento reducido se omite. Las navegaciones internas entre páginas no la repiten.

El sitio no añade un catálogo de precios, clientes, certificaciones o métricas comerciales que no existen. En cada recorrido se identifica que VERA es un prototipo funcional con datos de demostración y que la aceptación completa en producción sigue pendiente. La historia principal es **contexto → decisión → sustento → seguimiento**, sustentada por la [descripción del producto](../README.md) y los [flujos](wiki/Producto-y-flujos.md).

## Lenguaje visual e interacción

La composición usa una portada oscura anclada a los colores de VERA, tipografía de sistema, espacio amplio, líneas de relación y un esquema de cuatro etapas diseñado en CSS. No se usan fotografías genéricas, logotipos de clientes ajenos ni contadores ficticios. Las secciones interiores toman los tokens de `frontend/src/theme.css` para Claro, Oscuro, Contraste y FEMSA. El hero conserva una base nocturna de marca; el acento decorativo cambia con la apariencia.

Hay transiciones cortas en enlaces y tarjetas, una entrada suave del esquema y señales discretas en el recorrido. `prefers-reduced-motion: reduce` elimina estas animaciones. La perspectiva en **Soluciones** es una selección local que modifica texto explicativo, sin consultar API ni cambiar permisos. El menú móvil conserva todas las rutas, anuncia su estado y se cierra con Escape devolviendo el foco al botón. Los enlaces tienen texto visible y las páginas cuentan con títulos y encabezados propios.

Las referencias visuales consultadas fueron las páginas públicas de [Collibra](https://www.collibra.com/), [Monte Carlo](https://montecarlo.ai/), [Databricks](https://www.databricks.com/) y [Soda](https://soda.io/). Se tomó el patrón de mensaje principal claro, pocos recorridos y acceso separado de la explicación del producto; no se copiaron recursos, marcas, cifras ni afirmaciones de estas empresas.

Las imágenes `frontend/public/portfolio-demo.png` y `frontend/public/portfolio-demo-mobile.png` son capturas de la interfaz React de `Dashboard` en escritorio y móvil. Se generaron localmente con el rol `DIRECTOR` y la respuesta sintética de `frontend/e2e/fixtures.js`; las cifras y el nombre de cuenta son datos de prueba. **No son una captura de producción ni evidencia de persistencia o autorización del backend.** La portada las carga de forma diferida, reserva su espacio y usa la versión móvil donde corresponde. Si cambia el panel, se deben renovar ambas imágenes desde la interfaz vigente con datos sintéticos y mantener esta leyenda.

## Límites técnicos

Esta entrega es de frontend: no modifica autenticación, API, roles ni persistencia. El inicio de sesión sigue en `/`, independiente del sitio de presentación. La ruta de privacidad conserva íntegro el texto vigente. Los metadatos de vista previa social del HTML base siguen siendo generales del dominio; compartir una ruta interna puede mostrar el mismo resumen del sitio. La validación de un entorno real y la [aceptación pendiente](https://github.com/VERA-GRC-IRM/VERA/issues/113) son procesos separados de esta presentación.

## Mantenimiento de contenido

- Contrastar cualquier nueva afirmación comercial con el código, el estado de la demo y la evidencia vigente.
- Mantener la distinción entre función implementada, configuración disponible y capacidad futura.
- Si cambia la estructura del producto, actualizar simultáneamente portada, Soluciones, Confianza, Tecnología y la Wiki.
- Conservar el acceso y el aviso de privacidad visibles en móvil, teclado y todos los modos de apariencia.
- Mantener los enlaces de evidencia apuntando a fuentes vivas y revisar las capturas cuando cambie el diseño del panel.
