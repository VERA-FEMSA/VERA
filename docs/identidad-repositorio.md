# Identidad visible del repositorio

Esta ficha reúne el texto y la imagen necesarios para completar la tarjeta **About** y la vista previa social de GitHub. La portada del README, la Home de la Wiki y la imagen social comparten el isotipo VERA ya presente en `frontend/public/vera-logo.svg`; no se ha creado otra marca.

## Metadatos propuestos

**Descripción** (copiar en About):

> VERA organiza auditorías, riesgos, controles y evidencias para dar seguimiento a decisiones trazables.

**Homepage:** `https://vera-salva-ventures.vercel.app`, si el equipo ratifica que ése es el despliegue principal. Tanto esta URL como `https://vera-figbo.vercel.app` respondieron HTTP 200 al revisar el 16 de octubre de 2026; su disponibilidad no demuestra que compartan datos, configuración o versión. El README enlaza la primera. Conviene mantener una sola URL canónica en About y en la documentación.

**Topics:** `grc`, `audit-management`, `risk-management`, `evidence-management`, `react`, `supabase`, `azure-openai`. Son etiquetas descriptivas, no afirmaciones de aceptación funcional.

## Vista previa social

- Archivo listo para subir: [`docs/assets/social-preview.png`](assets/social-preview.png), 1280 × 640 píxeles.
- Fuente editable: [`docs/assets/social-preview.svg`](assets/social-preview.svg).
- Se compone del isotipo oficial, texto editorial y planos vectoriales en perspectiva. Los planos representan etapas del expediente; no simulan una pantalla, no contienen datos reales y no acreditan funcionalidad.
- El README carga el SVG para mantener la nitidez; la Wiki usa el PNG para una vista consistente. Ambos muestran la misma composición y tienen texto alternativo.
- Una persona con permiso de administración puede cargar el PNG en **Settings → Social preview**. GitHub recomienda 1280 × 640 píxeles y un archivo menor a 1 MB.

La identidad visual usa volumen y profundidad con la paleta azul y verde de VERA. La portada es una pieza de comunicación, no un sustituto de las pruebas, la aplicación ni el estado de aceptación de las HU.

## Comprobación posterior

1. Revisar About en la página principal y confirmar que la descripción, URL y topics aparecen como se acordó.
2. Compartir la URL del repositorio en un servicio que muestre vista previa y comprobar que presenta la imagen correcta; algunos servicios guardan el resultado en caché.
3. Al modificar el mensaje o el isotipo, actualizar el SVG y volver a generar el PNG de 1280 × 640 antes de publicarlo en la Wiki o en Social preview.
