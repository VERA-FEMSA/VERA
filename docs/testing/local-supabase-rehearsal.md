# Ensayo local de migraciones y restauración

El workflow manual [Local Supabase migration and restore rehearsal](../../.github/workflows/local-supabase-rehearsal.yml) levanta una instancia **desechable** de Supabase en un runner Ubuntu de GitHub Actions. No usa `supabase link`, credenciales del proyecto VERA, Vercel ni datos de producción.

## Qué comprueba

1. Inicia Supabase local con una versión fija de la CLI y reproduce las migraciones versionadas con `supabase db reset --local`.
2. Compara el número de migraciones aplicadas con los archivos SQL del repositorio.
3. Comprueba que las 12 tablas privadas esperadas existen, tienen RLS habilitado y no conceden lectura o escritura directa a los roles `anon` y `authenticated`.
4. Comprueba que el bucket `vera-evidence` es privado y conserva el límite de archivo de 3 MiB.
5. Inserta una propuesta y un riesgo sintéticos en las tablas reales de VERA. Cambia la propuesta de `OPEN` a `APPROVED` con incremento de versión y comprueba los tres eventos que generan los triggers de bitácora.
6. Intenta leer la propuesta como `anon` y `authenticated`; ambos accesos deben fallar por permisos. Reinicia el PostgreSQL local y vuelve a leer la propuesta, el riesgo, sus versiones y los eventos. Esta prueba mide persistencia de la base local, no reinicio del backend desplegado.
7. Crea una tabla temporal de prueba con una sola fila sintética, exporta sus datos con `pg_dump`, vacía la tabla, restaura con `psql`, verifica la fila y elimina la tabla.

El `Summary` publica conteos y tiempos, incluido el reinicio local. El artifact JSON conserva fecha UTC, SHA, resultado, número de migraciones, controles de acceso y duración del ensayo. Las claves locales generadas por Supabase y el volcado SQL temporal no se suben como artefactos.

## Cómo ejecutarlo

En **Actions → Local Supabase migration and restore rehearsal → Run workflow**, selecciona `main`. Solo miembros con permiso de ejecución pueden iniciarlo. El workflow falla si la migración, RLS, permisos, bucket o restauración sintética no coinciden con las expectativas. El [portal docente](https://vera-grc-irm.github.io/VERA/) enlaza la última corrida y marca si corresponde al SHA actual.

## Límite de interpretación

Esta prueba acredita que el esquema del repositorio puede instalarse desde cero, que datos sintéticos de VERA sobreviven al reinicio de **PostgreSQL local** y que funciona una exportación y restauración lógica sintética. No demuestra que exista una copia restaurable de Supabase Production, ni su RPO/RTO, integridad de archivos reales, persistencia del backend desplegado, permisos de cuentas reales o carga de 150/250 usuarios. Esas puertas siguen abiertas en [#113](https://github.com/VERA-GRC-IRM/VERA/issues/113). El proyecto Supabase sigue en Free y no se ha activado un plan de pago.
