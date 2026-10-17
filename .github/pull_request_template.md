## Alcance

<!-- Resume el cambio observable en 2-4 líneas. Enlaza la HU de Azure DevOps si aplica; indica el módulo afectado. -->

## Evidencia y decisiones

<!-- Explica reglas de negocio, datos, permisos funcionales o decisiones de diseño verificadas en archivos concretos. Para UI, añade antes/después o capturas sin datos reales. Para migraciones, indica compatibilidad y reversión. -->

## Verificación ejecutada

<!-- Registra solo comprobaciones que realmente ejecutaste. Usa «No ejecutado» cuando falte entorno o acceso. Un check verde no demuestra por sí mismo producción ni aceptación de una HU. -->

| Comprobación y enlace a evidencia | Entorno y SHA | Resultado observado | Duración |
| --- | --- | --- | --- |
| <!-- Ejemplo: npm run quality o URL del job --> | <!-- local/CI, SHA --> | <!-- PASS/FAIL/No ejecutado; cifra y límite --> | <!-- tiempo real o n/d --> |

## Riesgos y pendientes

<!-- Indica efectos sobre datos, usuarios, despliegue, compatibilidad o seguridad; cómo observar y revertir el cambio; y qué requiere validación con cuentas/datos reales. Si no aplica, explica por qué. -->

## Revisión antes de integrar

- [ ] Enlacé la HU o expliqué por qué no aplica y distinguí requisito, código, CI y producción.
- [ ] Revisé autorización en backend y visibilidad del registro si el cambio toca acceso funcional.
- [ ] No añadí secretos, datos personales o credenciales a código, fixtures, logs ni capturas.
- [ ] Revisé el diff y actualicé pruebas y documentación afectadas, o expliqué la excepción.
- [ ] Registré el plan de despliegue y reversión si cambia datos, configuración o comportamiento publicado.
