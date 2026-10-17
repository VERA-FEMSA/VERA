# Estado de calidad · acceso docente

Esta página es la entrada corta para revisar VERA **sin instalar nada**. La evidencia fechada corresponde al commit `720cef05d2e1c5b16a5552837dbc0c5c3043381e` de `main`, observado el **17 de octubre de 2026**. Para conocer el estado posterior, abre siempre el [workflow integral](https://github.com/VERA-FEMSA/VERA/actions/workflows/classroom-quality.yml) y elige su corrida más reciente.

## Resultado verificado en ese commit

| Verificación | Resultado observado | Evidencia |
| --- | --- | --- |
| Informe integral | **PASS**, duración total observada **363 s** | [Corrida #39059538661](https://github.com/VERA-FEMSA/VERA/actions/runs/39059538661) |
| Backend y calidad | **111/111** pruebas; **0** vulnerabilidades altas o críticas en la auditoría npm de esa corrida | *Summary* y artefacto de la misma corrida |
| Interfaz y accesibilidad | **186** casos aprobados; 0 fallidos, 0 inestables y 0 omitidos, con navegadores y tamaños configurados | *Summary*, logs y trazas de la misma corrida |
| CodeQL | El análisis terminó correctamente. **Había 46 ubicaciones abiertas** de `js/missing-rate-limiting` en `main` al corte. | [Security](https://github.com/VERA-FEMSA/VERA/security/code-scanning) y [corrección integrada mediante PR #97](https://github.com/VERA-FEMSA/VERA/pull/97) |

**Actualización posterior:** el [PR #97](https://github.com/VERA-FEMSA/VERA/pull/97) se integró en `main`. El [CodeQL de ese commit](https://github.com/VERA-FEMSA/VERA/actions/runs/39061317593) terminó correctamente y la API de alertas mostraba **0 abiertas** tras el análisis. La fila de 46 ubicaciones describe solo el corte histórico de `720cef05d2e1`. La alerta de secreto se revisa por separado.

El artefacto de la corrida conserva JSON, Markdown, logs e informe de navegador durante **30 días**. La cifra de duración individual mostrada para CodeQL en esa ejecución incluía la espera de otras fases; no debe presentarse como latencia del análisis. El [PR #95](https://github.com/VERA-FEMSA/VERA/pull/95) corrige el cronómetro de próximas corridas.

## Tres enlaces para una revisión completa

1. [Ver la corrida integral y su Summary](https://github.com/VERA-FEMSA/VERA/actions/runs/39059538661): resultado, SHA, pruebas, duración, logs y artefacto.
2. [Consultar el plan de 78 casos](https://github.com/VERA-FEMSA/VERA/blob/main/docs/testing/test-plan.md) y la [matriz de aceptación por HU](https://github.com/VERA-FEMSA/VERA/blob/main/docs/hu-acceptance-audit.md): qué está implementado, automatizado o pendiente.
3. [Abrir el workflow estable](https://github.com/VERA-FEMSA/VERA/actions/workflows/classroom-quality.yml): muestra corridas futuras sin cambiar el enlace. Solo integrantes con escritura pueden pulsar **Run workflow**; la lectura pública no requiere clonar el repositorio.

El [PR #98](https://github.com/VERA-FEMSA/VERA/pull/98) prepara un portal público que actualizará esta vista automáticamente en HTML, Markdown y JSON tras integrarse. Usa GitHub Actions y Pages, sin llamadas a modelos ni consumo de tokens de IA.

## Interpretación responsable

Las 78 filas del plan son **casos planeados**, no 78 aprobaciones de producción. Los E2E usan fixtures de API y no verifican persistencia real ni sesiones de todos los roles. La prueba de carga de 150/250 usuarios requiere staging autorizado. El despliegue del equipo muestra actualmente la barrera **Login – Vercel**, así que esta evidencia no certifica funcionamiento del backend ni aceptación funcional allí. Las alertas de Security deben revisarse aparte; un check verde no equivale a cero hallazgos.
