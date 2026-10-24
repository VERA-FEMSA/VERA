# Detalles de auditoría sin salir del chat

En una conversación guardada escribe `Detalles de la auditoría AUD-02`. VERA consulta el expediente y sus relaciones visibles para la cuenta autenticada. La respuesta muestra estado, área, avance, periodo, objetivo, alcance y los primeros tres riesgos, controles, hallazgos y evidencias relacionados. Muestra los conteos completos por sección y enlaces al registro original.

Si hay más de tres elementos, continúa con `Más riesgos de la auditoría AUD-02`, `Más controles de la auditoría AUD-02`, `Más hallazgos de la auditoría AUD-02` o `Más evidencias de la auditoría AUD-02`. Cada respuesta adicional incluye hasta cinco registros. La consulta vuelve a aplicar los permisos en cada turno; un ID ajeno no se revela por el chat. Si falta una relación o no hay acceso, lo dice sin inventar datos. Esta operación sólo lee y no llama a Azure OpenAI, por lo que no consume tokens del modelo.

El detalle resume datos vigentes y mantiene los expedientes originales accesibles en sus módulos. El entorno `memory` no prueba persistencia en Supabase. La aceptación autenticada del SHA final en Production continúa pendiente en [#226](https://github.com/VERA-GRC-IRM/VERA/issues/226).
