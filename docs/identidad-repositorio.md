# Identidad visible del repositorio

Esta ficha reúne el texto y la imagen necesarios para completar la tarjeta **About** y la vista previa social de GitHub. La portada del README, la Home de la Wiki y la imagen social comparten el isotipo VERA ya presente en `frontend/public/vera-logo.svg`; no se ha creado otra marca.

## Metadatos propuestos

**Descripción** (configurada en About):

> VERA organiza auditorías, riesgos, controles y evidencias para dar seguimiento a decisiones trazables.

**Homepage del repositorio del equipo:** `https://vera-figbo.vercel.app`. GitHub registró un despliegue de Production del commit `720cef05d2e1c5b16a5552837dbc0c5c3043381e` desde este repositorio y la URL pública respondió HTTP 200 el 17 de octubre de 2026. El README y la Wiki enlazan ese entorno. La instancia `https://vera-salva-ventures.vercel.app` permanece documentada como despliegue independiente; no se presume que comparta datos, configuración o versión con el entorno del equipo.

**Topics configurados:** `academic-project`, `grc`, `audit-management`, `risk-management`, `evidence-management`, `react`, `supabase`, `azure-openai`. Son etiquetas descriptivas, no afirmaciones de aceptación funcional.

## Vista previa social

- Archivo publicado en Social preview: [`docs/assets/social-preview.png`](assets/social-preview.png), 1280 × 640 píxeles.
- Fuente editable: [`docs/assets/social-preview.svg`](assets/social-preview.svg).
- Se compone del isotipo oficial, texto editorial y planos vectoriales en perspectiva. Los planos representan etapas del expediente; no simulan una pantalla, no contienen datos reales y no acreditan funcionalidad.
- El README carga el SVG para mantener la nitidez; la Wiki usa el PNG para una vista consistente. Ambos muestran la misma composición y tienen texto alternativo.
- El PNG se cargó en **Settings → Social preview** el 17 de octubre de 2026 y se comprobó visualmente en la configuración del repositorio. GitHub recomienda 1280 × 640 píxeles y un archivo menor a 1 MB.

La identidad visual usa volumen y profundidad con la paleta azul y verde de VERA. La portada es una pieza de comunicación, no un sustituto de las pruebas, la aplicación ni el estado de aceptación de las HU.

## Comprobación posterior

1. Revisar About en la página principal y confirmar que la descripción, URL y topics aparecen como se acordó.
2. Compartir la URL del repositorio en un servicio que muestre vista previa y comprobar que presenta la imagen correcta; algunos servicios guardan el resultado en caché.
3. Al modificar el mensaje o el isotipo, actualizar el SVG y volver a generar el PNG de 1280 × 640 antes de publicarlo en la Wiki o en Social preview.
