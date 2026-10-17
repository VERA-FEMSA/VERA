# Operación del repositorio en GitHub

Esta guía complementa las HU de Azure DevOps. GitHub conserva código, cambios propuestos, evidencia de CI, avisos de seguridad y entregas; las historias y su aceptación funcional siguen en el sistema de trabajo del equipo.

## Flujo de cambio

1. Partir de `main` y abrir un PR por resultado revisable. Enlazar la HU cuando exista.
2. Completar la plantilla de PR con decisiones, pruebas realmente ejecutadas, entorno, commit, duración y riesgos.
3. Esperar los checks obligatorios: `Quality gates (Node.js 22)`, `UI E2E (Chrome, Edge, Firefox, mobile/tablet)` y `Analyze JavaScript and TypeScript`.
4. Obtener una aprobación ajena al autor y resolver conversaciones. Si cambia el PR, la aprobación anterior queda obsoleta.
5. Integrar y observar el despliegue correspondiente. GitHub elimina automáticamente la rama integrada; las ramas históricas se revisan antes de borrarlas.

El [ruleset de main](https://github.com/VERA-FEMSA/VERA/rules/25312937) exige estos pasos, impide force push y protege la rama contra borrado. Ningún archivo está reservado a una persona o equipo.

La plantilla `.github/pull_request_template.md` aparece al abrir un PR en GitHub. El workflow `PR documentation` comprueba sus cuatro secciones y una fila de verificación en PR humanos listos para revisión; omite borradores y PR de bots. Solo lee metadatos del PR y el código de la rama base: no ejecuta archivos propuestos ni llama a un modelo. Al integrarse este workflow se observará en PR futuros; no se añade a los checks obligatorios del ruleset hasta comprobar su operación en `main`.

## Calidad y seguridad

- [QUALITY.md](../QUALITY.md) explica la ejecución local y el alcance de cada gate. La [matriz de aceptación](hu-acceptance-audit.md) separa implementación, CI y validación remota.
- CodeQL puede terminar correctamente y dejar alertas abiertas. Clasifica cada alerta con ruta, regla, exposición y evidencia; corrige o descarta solo con una razón técnica registrada.
- Secret scanning y push protection están activados. Una alerta de secreto exige revocación o rotación en el proveedor: borrar el archivo actual no invalida el valor del historial.
- Dependabot abre PR de versiones y de seguridad. Las versiones menores y parches futuros se agrupan por ecosistema para concentrar la revisión; las actualizaciones mayores permanecen individuales. Las actualizaciones mayores requieren revisar compatibilidad; no se fusionan solo por mostrar checks verdes. Los PR ya abiertos pueden conservar su forma anterior hasta la siguiente ejecución de Dependabot.
- Las acciones usadas en workflows se fijan a SHA. Los permisos predeterminados de los workflows son de lectura; cada workflow declara los permisos adicionales indispensables.

## Entornos y publicación

La URL de referencia del repositorio del equipo es [vera-figbo.vercel.app](https://vera-figbo.vercel.app). Un HTTP 200 o un despliegue con estado exitoso solo acredita disponibilidad de esa revisión, no aceptación de las HU. Otros despliegues se documentan como entornos independientes y no se presume que compartan datos o configuración.

Los entornos GitHub `Preview` y `Production` registran despliegues, pero una regla de aprobación de GitHub Actions solo protege jobs que declaran ese entorno. La integración externa de Vercel debe gobernarse también en Vercel; no se debe afirmar que una regla de GitHub la bloquea sin comprobarlo.

Para una entrega publicable, conserva un registro con commit, fecha, entorno, cambios, migraciones, checks, pruebas funcionales con rol/datos sintéticos, limitaciones y plan de reversión. Crea un tag y una release solo después de decidir el alcance de esa entrega. No uses una release para aparentar aceptación de historias aún pendientes.

## Documentación

El README es la entrada para visitantes. La Wiki explica producto y operación. Su fuente revisable vive en `docs/wiki/`; al integrar cambios allí, sincroniza la Wiki pública y comprueba los enlaces. Las evidencias históricas permanecen identificadas por fecha y commit para evitar que se lean como estado actual.
