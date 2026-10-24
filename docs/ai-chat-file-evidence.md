# Archivos del chat como evidencia

Los roles autorizados pueden convertir un archivo privado ya adjunto a una conversación guardada en una evidencia de un riesgo, control o auditoría visible. VERA copia el archivo a una ruta privada independiente del chat: quitar el adjunto después no borra la evidencia. El modelo de lenguaje no decide la entidad, no escribe registros y no recibe permisos adicionales.

## Recorrido

1. Adjunta un PDF, DOCX, TXT, CSV o imagen en el chat. Selecciónalo en «Consultar archivo»; la carga lo selecciona automáticamente. También se puede seleccionar un archivo privado del proyecto. El modo «Biblioteca del proyecto» consulta fragmentos y no representa un archivo individual.
2. Escribe `Vincula este archivo como evidencia`. Completa los campos solicitados en un solo mensaje:

   ```text
   Título: Acta de revisión
   Descripción: Documento que respalda la revisión del proceso auditado
   Tipo: documento
   Entidad: auditoría
   Identificador: AUD-01
   ```

3. Comprueba nombre del archivo, tamaño, descripción y expediente en la vista previa. Escribe `Confirmar archivo como evidencia` dentro de cinco minutos. Otra pregunta descarta esa vista previa.
4. La conversación devuelve el ID de evidencia. El expediente conserva una copia privada descargable mediante los permisos existentes, aun si después se quita el adjunto del chat.

El campo «Tipo» admite documento, captura, reporte u otro. «Entidad» admite riesgo, control o auditoría. El identificador debe corresponder a un registro visible para la cuenta.

## Límites y recuperación

- La carga inicial mantiene el límite de 2 MB por archivo y los formatos ya aceptados por el chat. La evidencia conserva el tipo MIME real y se almacena en el bucket privado existente.
- Una conversación temporal y los roles sin escritura reciben orientación, sin guardar nada. En cada paso, el servidor vuelve a comprobar cuenta activa, rol, propiedad del archivo y acceso al expediente. La vista previa vence; la reserva de la conversación antecede a la escritura.
- Un identificador de operación permite reconocer un reintento sin crear otra evidencia. Si la escritura final ocurre pero falla la actualización del historial, VERA muestra el resultado y pide recargar antes de seguir. Un error al crear el registro intenta retirar la copia huérfana.
- Un archivo referenciado en chat no sustituye el original ni valida su contenido. Los textos admitidos se indexan con la cobertura existente; imágenes pueden quedar pendientes de OCR. La aceptación autenticada con Supabase Production sigue separada de las pruebas locales en [#226](https://github.com/VERA-GRC-IRM/VERA/issues/226).

Para evidencias sin archivo, consulta [referencias desde la conversación](ai-chat-evidence-create.md).
