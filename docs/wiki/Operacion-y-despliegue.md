# Operación y despliegue

Esta página es una ruta de lectura y comprobación. La [guía de Supabase](https://github.com/humbertofigb15/VERA/blob/main/docs/supabase-planning.md), el [runbook de IA](https://github.com/humbertofigb15/VERA/blob/main/docs/hu34-azure-openai.md) y el [runbook operativo](https://github.com/humbertofigb15/VERA/blob/main/docs/testing/operations-runbook.md) contienen pasos específicos de cada subsistema.

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

La [instancia propia de VERA](https://vera-salva-ventures.vercel.app) está accesible por HTTPS, pero las pantallas de trabajo exigen una cuenta activa del sistema. Los runbooks documentan configuración y comprobaciones puntuales de Supabase y Azure OpenAI. El [estado de aceptación por HU](https://github.com/humbertofigb15/VERA/blob/main/docs/wiki/Modulos-y-HU.md) mantiene separadas esas comprobaciones de una prueba funcional exhaustiva con todas las identidades.

Para una comprobación de despliegue, registra **SHA publicado, entorno, fecha, rol, datos sintéticos, pasos y resultado**. No copies JWT, cookies, claves, contraseñas ni respuestas privadas a capturas o reportes. Un HTTP 200 en login o un despliegue `READY` demuestra disponibilidad de esa ruta, no cierre funcional.

## Cambio controlado

1. Identifica el proyecto y entorno de destino; revisa migraciones y modos activos.
2. Revisa PR, pruebas y posibles cambios de datos antes de publicar.
3. Comprueba acceso y persistencia con el rol mínimo necesario.
4. Observa 429/5xx, latencia y logs sin contenido sensible.
5. Si la IA falla, el backend permite desactivarla con `VERA_AI_ENABLED=false` y redesplegar; los módulos de negocio no deben depender de una respuesta generativa para conservar sus registros.

No ejecutes pruebas de carga contra producción sin una ventana coordinada. La [carga preparada](https://github.com/humbertofigb15/VERA/actions/workflows/load-test.yml) está destinada a staging autorizado.
