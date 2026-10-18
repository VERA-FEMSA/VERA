# Operación y despliegue

Esta página es una ruta de lectura y comprobación. La [guía de Supabase](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/supabase-planning.md), el [runbook de IA](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/hu34-azure-openai.md) y el [runbook operativo](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/testing/operations-runbook.md) contienen pasos específicos de cada subsistema.

## Demo local

Se requiere Node.js 22 y npm. En PowerShell, desde la raíz:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Copia el valor generado a `JWT_SECRET` en `.env`. Después inicia API y frontend en terminales separadas:

```powershell
npm start --prefix backend
npm run dev --prefix frontend
```

Vite muestra la URL local. El modo inicial es `memory`; los datos demo se reinician con el backend. No uses esas cuentas ni datos reales para producción. `.env` es local y no debe subirse a Git.

## Instancia publicada

La [instancia propia de VERA](https://www.vera-digital-systems.com/) está conectada al repositorio de la organización y a la rama `main`. El dominio sin `www` redirige al dominio canónico con `www`; la dirección anterior `vera-salva-ventures.vercel.app` sigue siendo un alias del proyecto. El [smoke público automático](https://github.com/VERA-GRC-IRM/VERA/actions/workflows/production-smoke.yml) comprueba portada, acceso y rechazo de rutas protegidas sin sesión; el [portal de calidad](https://vera-grc-irm.github.io/VERA/) muestra el SHA de cada corrida. Para demostrar una versión publicada, coteja además el SHA del deployment en Vercel. El 17 de octubre de 2026, la antigua URL `vera-figbo.vercel.app` respondió con la barrera **Login – Vercel**; ese hallazgo histórico no describe la instancia propia ni permite equiparar sus datos o configuración. Los runbooks documentan comprobaciones puntuales de Supabase y Azure OpenAI. El [estado de aceptación por HU](https://github.com/VERA-GRC-IRM/VERA/wiki/Modulos-y-HU) separa esas comprobaciones de la prueba funcional exhaustiva con cuentas autorizadas.

Para compartir el sitio, usa `https://www.vera-digital-systems.com/`. El título, la descripción, el favicon y las etiquetas de vista previa están en [`frontend/index.html`](https://github.com/VERA-GRC-IRM/VERA/blob/main/frontend/index.html); la tarjeta horizontal reutiliza el [diseño de la portada del repositorio](https://github.com/VERA-GRC-IRM/VERA/blob/main/docs/assets/social-preview.png) y el isotipo oficial. Las etiquetas son estáticas para toda la aplicación: una ruta protegida compartida muestra la vista previa general, no información privada del expediente.

Para una comprobación de despliegue, registra **SHA publicado, entorno, fecha, rol, datos sintéticos, pasos y resultado**. No copies JWT, cookies, claves, contraseñas ni respuestas privadas a capturas o reportes. Un HTTP 200 en login o un despliegue `READY` demuestra disponibilidad de esa ruta, no cierre funcional.

## Cambio controlado

1. Identifica el proyecto y entorno de destino; revisa migraciones y modos activos.
2. Revisa PR, pruebas y posibles cambios de datos antes de publicar.
3. Comprueba acceso y persistencia con el rol mínimo necesario.
4. Observa 429/5xx, latencia y logs sin contenido sensible.
5. Si la IA falla, el backend permite desactivarla con `VERA_AI_ENABLED=false` y redesplegar; los módulos de negocio no deben depender de una respuesta generativa para conservar sus registros.

No ejecutes pruebas de carga contra producción sin una ventana coordinada. La [carga preparada](https://github.com/VERA-GRC-IRM/VERA/actions/workflows/load-test.yml) está destinada a staging autorizado.
