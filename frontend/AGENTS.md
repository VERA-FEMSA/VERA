# Frontend de VERA

Aplica junto con el `AGENTS.md` de la raíz al trabajar en `frontend/`.

- Localiza la ruta en `src/App.jsx`, la página/componente, el cliente en `src/services/` y el contrato HTTP real antes de cambiar una pantalla.
- `ProtectedRoute`, el sidebar y los botones por rol son controles de interfaz; la API debe autorizar cada lectura y escritura. Sincroniza los mensajes y acciones visibles con la política vigente del backend.
- Nunca coloques `JWT_SECRET`, claves Supabase de servidor ni claves Azure en `VITE_*`, código cliente o fixtures de navegador.
- Revisa estados de carga, error y vacío; teclado, etiquetas accesibles y tamaños móvil/tablet en los flujos afectados. No afirmes compatibilidad con un navegador que no ejecutaste.
- Usa `frontend/e2e/` y `frontend/playwright.config.js` para comprobar flujos de interfaz; no confundas una prueba visual con una validación de permisos del servidor.

## Code Review Rules

- Marca cualquier cambio que trate ocultar una acción en React como sustituto de autorización del backend.
- Marca secretos de servidor o respuestas privadas innecesarias expuestas al navegador.
