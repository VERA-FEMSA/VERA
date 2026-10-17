# Política de seguridad de VERA

## Alcance

El código de la rama `main` es la referencia del prototipo académico. Un despliegue, una demo local y un PR pueden usar configuraciones y datos distintos; incluye el entorno y el commit al describir un problema. No se declara una versión de producción soportada con garantía operativa.

## Cómo reportar una vulnerabilidad

Abre [Security Advisories](https://github.com/VERA-FEMSA/VERA/security/advisories) y selecciona **Report a vulnerability** para enviar un informe privado. Incluye comportamiento observado, pasos mínimos de reproducción, impacto, commit o versión y una propuesta de mitigación si la tienes. No publiques exploits, secretos, tokens ni datos personales en Issues o PR públicos.

El equipo evaluará el informe de forma privada, registrará la decisión y coordinará corrección, verificación y divulgación cuando corresponda. No se promete un plazo de respuesta que el proyecto no pueda garantizar.

## Credenciales y datos

- Guarda secretos solo en el servicio que los necesita, con el alcance mínimo. No uses variables públicas de Vite para claves de servidor.
- Si una clave entra en Git, considera la clave expuesta aunque el archivo se borre del estado actual. Rótala o revócala en el proveedor, actualiza los despliegues dependientes y verifica la operación antes de cerrar la alerta.
- No copies credenciales completas a logs, reportes, capturas, Issues ni PR.
- El escaneo de secretos y CodeQL son controles de detección; un resultado verde no certifica ausencia de fallos.

Para el estado de hallazgos consulta la pestaña [Security](https://github.com/VERA-FEMSA/VERA/security). Las alertas requieren clasificación basada en evidencia y seguimiento hasta su resolución.
