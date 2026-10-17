# Persistencia y migraciones de VERA

Aplica junto con el `AGENTS.md` de la raíz al trabajar en `supabase/`.

- Lee `docs/supabase-planning.md`, `backend/config/storeModes.js` y los repositorios afectados antes de diseñar una migración. Conserva la relación entre el esquema, el adaptador y sus dependencias de activación.
- Añade migraciones versionadas; no reescribas una ya aplicada al proyecto compartido sin un plan de conciliación explícito. Considera filas existentes, restricciones, índices y compatibilidad del despliegue.
- Mantén RLS y el acceso de servidor de las tablas privadas. No expongas una clave de servicio ni concedas acceso directo público para resolver un error de autorización.
- Verifica el proyecto de destino y el plan antes de cualquier operación remota. Nunca uses `supabase db reset --linked` con datos reales. Una prueba con adaptador simulado no acredita persistencia tras reinicio.

## Code Review Rules

- Marca migraciones que pierdan datos, relajen acceso privado o carezcan de correspondencia con el repositorio que escribe/lee la entidad.
