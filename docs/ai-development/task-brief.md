# Plantilla de tarea para un asistente de código

El resultado depende de la petición que recibe el asistente. Copia esta ficha, rellena lo que sabes y deja **“por confirmar”** donde falten datos. No pegues contraseñas, tokens, archivos privados ni datos personales.

```text
Repositorio y base: humbertofigb15/VERA, rama main actualizada
Objetivo observable:
Alcance incluido:
Fuera de alcance:
Criterios de aceptación o enlace a la HU completa:
Roles y entidades que intervienen:
Entorno a verificar: local / CI / staging / producción / por confirmar
Datos de prueba permitidos: sintéticos / por confirmar
Restricciones: no tocar producción ni ampliar permisos sin requisito explícito
Entrega: diff o PR, explicación, comandos ejecutados y resultados, riesgos y pendientes

Primero lee AGENTS.md, los AGENTS.md de las rutas afectadas y el código/pruebas actuales.
Separa requisitos de comportamiento existente. Señala contradicciones con ruta y línea.
Antes de editar, resume el flujo de datos y autorización que vas a tocar.
Al terminar, informa solo verificaciones realmente ejecutadas y su entorno.
```

Para tareas de lectura o diagnóstico, cambia la entrega a **hallazgos con evidencia** y no pidas modificaciones. Para un despliegue, una migración remota o cambios de configuración, especifica el proyecto de destino, la reversión y quién puede autorizarlo; la ficha por sí sola no concede acceso ni aprobación.
