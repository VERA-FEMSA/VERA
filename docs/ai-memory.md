# Memoria explícita y controlada

VERA no infiere ni guarda recuerdos del chat por su cuenta. La persona escribe hasta ocho notas de hasta 200 caracteres en «Memoria personalizada». Puede verlas, corregirlas, pausarlas o borrarlas. Cada nota es privada de la cuenta y del rol. El recorrido de otro rol no puede abrirla.

Solo las notas activas se envían al modelo cuando una respuesta requiere generación con Azure OpenAI. Se presentan como preferencias escritas por la persona, dentro de una sección marcada como **no confiable y no factual**. Nunca sustituyen el contexto autorizado, el historial de fuentes ni los permisos. Los conteos deterministas, la búsqueda documental y las acciones de negocio no se alteran por una nota. La memoria no se usa para entrenar el modelo de VERA.

La API valida tamaño y propiedad, emplea versión optimista para evitar sobrescribir cambios concurrentes y usa una tabla privada con RLS sin acceso directo de `anon` ni `authenticated`. El modo Supabase no simula éxito en memoria cuando falla el almacén. Las notas pueden contener información personal; la interfaz pide no escribir contraseñas ni claves.

## Activación y aceptación

1. Aplicar, en orden, las migraciones de conversaciones y proyectos, luego `20261022040000_ai_memory.sql`, siempre tras comprobar el proyecto Supabase de destino.
2. Activar `VERA_AI_MEMORY_ENABLED=true` junto con `VERA_AI_CONVERSATIONS_ENABLED=true` y redesplegar.
3. Con cuentas sintéticas de dos roles, probar persistencia, pausa, edición, eliminación, acceso cruzado y que la nota no se toma como fuente. Repetir después de un nuevo despliegue.

Las pruebas de unidad y navegador con datos simulados no sustituyen la aceptación en Production.
