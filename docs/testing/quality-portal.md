# Portal docente de calidad

El [portal de calidad](https://vera-femsa.github.io/VERA/) ofrece una vista pública y de solo lectura del commit actual de `main`, el estado de las corridas de calidad, navegador, CodeQL, evaluación sintética de IA y el informe integral. Cada resultado abre la ejecución original de GitHub Actions con sus pasos, logs, duración y artefactos disponibles. La misma publicación incluye una [bitácora Markdown](https://vera-femsa.github.io/VERA/status.md) y [datos JSON](https://vera-femsa.github.io/VERA/status.json) con hora, SHA, estados y tiempos observados.

## Actualización

El workflow [`quality-portal.yml`](../../.github/workflows/quality-portal.yml) publica la página en GitHub Pages después de las verificaciones de `main`, al cambiar el generador, de forma programada y por ejecución manual. El generador [`build-quality-portal.py`](../../scripts/build-quality-portal.py) consulta la API de GitHub con el `GITHUB_TOKEN` temporal de solo lectura. No llama a Azure OpenAI, Copilot ni otros modelos; usa únicamente minutos ordinarios de GitHub Actions.

El portal solo llama **vigente** a una verificación terminada cuyo SHA coincide con el `main` consultado. Si falta una corrida, está en curso o corresponde a otro commit, muestra ese límite. Si la API no permite identificar `main`, el generador falla y no publica un estado ambiguo. Un workflow verde puede mantener alertas abiertas en Security.

## Qué debe revisar un docente

1. Abre el portal y anota su hora de actualización y el SHA de `main`.
2. Abre el **informe integral**. En la pestaña *Summary* encontrarás recuentos, cobertura y duraciones; sus artefactos se conservan por 30 días.
3. Sigue los enlaces a [plan de pruebas](test-plan.md) y [estado por HU](../hu-acceptance-audit.md) para distinguir casos implementados, simulados y pendientes.

El [workflow integral](https://github.com/VERA-FEMSA/VERA/actions/workflows/classroom-quality.yml) sigue siendo el enlace estable si GitHub Pages no está disponible. La [guía de ejecución](professor-quick-run.md) explica cómo iniciar una corrida; solo usuarios con escritura pueden pulsar **Run workflow**.

## Límite de la evidencia

La página no sustituye pruebas con usuarios reales, persistencia Supabase, revisión de alertas, 150/250 usuarios en staging ni aceptación funcional en producción. La marca *Aprobada* describe el resultado de una suite sobre un SHA, no el estado global del producto. El portal no usa credenciales de VERA ni expone datos del sistema.
