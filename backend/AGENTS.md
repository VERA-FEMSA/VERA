# Backend de VERA

Aplica junto con el `AGENTS.md` de la raíz al trabajar en `backend/`.

- Sigue la operación completa: montaje en `server.js` → ruta → autenticación/roles → controlador/servicio → repositorio → respuesta. Comprueba acceso al **registro concreto** cuando exista asignación o visibilidad limitada.
- Toma roles y conjuntos de escritura de `config/roles.js` y reglas de cada ruta/controlador; no infieras permisos del nombre del rol ni del frontend.
- Conserva la semántica de los modos `memory` y Supabase. Un error de Supabase no debe devolver éxito con un objeto temporal. Si cambia el contrato de datos, revisa adaptadores y migración.
- Valida entradas y transiciones en el servidor. Mantén la respuesta y los logs libres de credenciales, hashes, tokens y datos privados innecesarios.
- Busca la prueba unitaria o de integración relacionada en `tests/`. Los mocks prueban el contrato local, no persistencia ni autorización con cuentas reales desplegadas.

## Code Review Rules

- Marca rutas nuevas o modificadas que omiten `verifyToken`, permisos por rol o comprobación de propiedad/visibilidad requerida por el recurso.
- Marca fallos de almacenamiento persistente que se oculten con un fallback a memoria o se comuniquen como éxito.
