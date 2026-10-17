# Límites de solicitudes de la API

La aplicación instala un límite general de 600 solicitudes por IP y por ventana de 15 minutos antes de procesar JSON y montar las rutas. Los endpoints de autenticación tienen además un límite específico de 30 solicitudes por IP y por ventana de 15 minutos. Las operaciones de IA y evidencias conservan sus límites más estrictos por usuario cuando están definidos en sus rutas.

Cuando se alcanza un límite, la API devuelve HTTP 429 y un código de error. La cabecera estándar informa la ventana correspondiente. La comprobación funcional debe distinguir este resultado de fallos 5xx.

## Alcance operativo

`express-rate-limit` usa el almacén en memoria por defecto. En un despliegue con varias instancias, cada una cuenta por separado; los reinicios borran los contadores. Por ello, este control reduce abusos simples y evita rutas sin limitador, pero no constituye una cuota global ni una defensa suficiente frente a tráfico distribuido. Antes de declarar protección de producción, el equipo que administra el despliegue debe verificar la topología y añadir un límite compartido o de borde con observación de respuestas 429.

El servidor confía en un salto de proxy. Si cambia la topología del despliegue, hay que revisar `trust proxy` y la identidad IP utilizada por el limitador. La carga de 150/250 usuarios virtuales se ejecuta únicamente en staging autorizado y debe registrar por separado solicitudes limitadas, fallos y latencia.

Este cambio responde al hallazgo CodeQL `js/missing-rate-limiting`. El cierre de alertas se comprueba en el análisis de la rama y, tras la integración, en el análisis de `main`; un check CodeQL verde por sí solo no confirma que el número de alertas haya bajado.
