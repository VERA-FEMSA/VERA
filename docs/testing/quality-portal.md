# Plataforma de aseguramiento de calidad

La [plataforma de calidad](https://vera-grc-irm.github.io/VERA/) ofrece una vista pública y de solo lectura del commit actual de `main`, el estado de las corridas de calidad, navegador, CodeQL, evaluación sintética de IA, aceptación de roles en Preview, smoke de Production e informe integral. Cuando el informe integral del mismo SHA está disponible, presenta recuentos de backend, navegador e IA, cobertura de líneas, ramas y funciones, duración, auditoría npm y trazabilidad. Cada resultado abre la ejecución original de GitHub Actions con sus pasos, logs, duración y artefactos disponibles. La misma publicación incluye una [bitácora Markdown](https://vera-grc-irm.github.io/VERA/status.md) y [datos JSON](https://vera-grc-irm.github.io/VERA/status.json) con hora, SHA, estados y tiempos observados.

La fila **Supabase local** enlaza un [ensayo de migraciones y restauración sintética](local-supabase-rehearsal.md) en una base desechable. Ese resultado no es un respaldo de producción ni cierra la verificación de persistencia real.

## Actualización

El workflow [`quality-portal.yml`](../../.github/workflows/quality-portal.yml) publica la página en GitHub Pages después de las verificaciones de `main`, al cambiar el generador, de forma programada y por ejecución manual. El generador [`build-quality-portal.py`](../../scripts/build-quality-portal.py) consulta la API de GitHub con el `GITHUB_TOKEN` temporal de solo lectura. No llama a Azure OpenAI, Copilot ni otros modelos; usa únicamente minutos ordinarios de GitHub Actions.

El portal solo llama **vigente** a una verificación terminada cuyo SHA del workflow coincide con el `main` consultado. Si falta una corrida, está en curso o corresponde a otro commit, muestra ese límite. Para Preview y Production, ese SHA corresponde al **código que hizo la comprobación**, no demuestra por sí mismo qué deployment recibió las solicitudes: el artifact JSON identifica la URL y la hora, y Vercel permite cotejar su deployment y commit. Si la API no permite identificar `main`, el generador falla y no publica un estado ambiguo. Un workflow verde puede mantener alertas abiertas en Security.

Los tiempos de la tabla son aproximaciones calculadas con `run_started_at` y `updated_at` de la API. Para una duración exacta de un job o de una suite, abre la corrida y su `Summary`.

## Recorrido de revisión

1. Abre el portal y anota su hora de actualización y el SHA de `main`.
2. Contrasta los indicadores con el **informe integral** del mismo commit. En la pestaña *Summary* encontrarás recuentos, cobertura y duraciones; sus artefactos se conservan por 30 días. La plataforma oculta las cifras si falta un informe válido del SHA vigente.
3. Sigue los enlaces a [plan de pruebas](test-plan.md) y [estado por HU](../hu-acceptance-audit.md) para distinguir casos implementados, simulados y pendientes.

El [workflow integral](https://github.com/VERA-GRC-IRM/VERA/actions/workflows/classroom-quality.yml) sigue siendo el enlace estable si GitHub Pages no está disponible. El [corte archivado en Releases](https://github.com/VERA-GRC-IRM/VERA/releases) conserva el resumen y las métricas agregadas después de la caducidad del artefacto de Actions; sus enlaces a logs históricos pueden dejar de funcionar. La [guía de ejecución](professor-quick-run.md) explica cómo iniciar una corrida; solo usuarios con escritura pueden pulsar **Run workflow**.

El enlace de una corrida histórica del antiguo propietario del repositorio puede redirigir a la organización actual. Para compartir una referencia permanente al estado vigente, usa el portal de esta página; GitHub Pages cambió de dirección al transferir el repositorio y la URL antigua de Pages no redirige automáticamente.

## Límite de la evidencia

La página no sustituye pruebas con cuentas de producción autorizadas, persistencia Supabase de Production, un respaldo real restaurable, revisión de alertas, 150/250 usuarios en staging ni aceptación funcional en producción. Preview usa credenciales de demostración y datos en memoria; su workflow no publica tokens ni respuestas privadas. La marca *Aprobada* describe el resultado y alcance de una suite, no el estado global del producto.
