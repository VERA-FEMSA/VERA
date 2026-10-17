# Identidad visible del repositorio

Esta ficha reúne el texto y la imagen necesarios para completar la tarjeta **About** y la vista previa social de GitHub. La portada del README y la imagen usan el isotipo VERA ya presente en `frontend/public/vera-logo.svg`; no se ha creado otra marca.

## Metadatos propuestos

**Descripción** (copiar en About):

> VERA organiza auditorías, riesgos, controles y evidencias para dar seguimiento a decisiones trazables.

**Homepage:** `https://vera-salva-ventures.vercel.app`, si el equipo ratifica que ése es el despliegue principal. Tanto esta URL como `https://vera-figbo.vercel.app` respondieron HTTP 200 al revisar el 16 de octubre de 2026; su disponibilidad no demuestra que compartan datos, configuración o versión. El README enlaza la primera. Conviene mantener una sola URL canónica en About y en la documentación.

**Topics:** `grc`, `audit-management`, `risk-management`, `evidence-management`, `react`, `supabase`, `azure-openai`. Son etiquetas descriptivas, no afirmaciones de aceptación funcional.

## Vista previa social

- Archivo listo para subir: [`docs/assets/social-preview.png`](assets/social-preview.png), 1280 × 640 píxeles.
- Fuente editable: [`docs/assets/social-preview.svg`](assets/social-preview.svg).
- Se compone del isotipo oficial y texto exacto; no contiene capturas reconstruidas ni datos reales.
- Una persona con permiso de administración puede cargar el PNG en **Settings → Social preview**. GitHub recomienda 1280 × 640 píxeles y un archivo menor a 1 MB.

La captura en el README es un archivo recibido del equipo. Muestra la pantalla de Planificación con datos de demostración; no se presenta como evidencia de producción ni como una captura de todos los módulos.

## Comprobación posterior

1. Revisar About en la página principal y confirmar que la descripción, URL y topics aparecen como se acordó.
2. Compartir la URL del repositorio en un servicio que muestre vista previa y comprobar que presenta la imagen correcta; algunos servicios guardan el resultado en caché.
3. Confirmar que la captura del README sigue representando la interfaz actual y reemplazarla cuando cambie de manera material.
