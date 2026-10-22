# RF-23 · Cierre documentado de hallazgos

Un hallazgo abierto conserva su vínculo con el control, el riesgo y la auditoría. Una acción de seguimiento vinculada al hallazgo representa el plan correctivo. VERA permite registrar la decisión de cierre solo después de que exista al menos una acción y todas estén terminadas.

## Regla operativa

1. Registrar el hallazgo desde un control evaluado como inefectivo.
2. Crear una o más acciones con origen `FINDING`, responsable y fecha objetivo en **Pendientes**. El responsable registra `DONE` con una explicación.
3. En **Mapa de controles → Hallazgos de controles**, revisar el progreso y pulsar **Cerrar hallazgo**. Escribir una conclusión. El servidor comprueba nuevamente estados, rol, vínculo y versión antes de conservar `CLOSED`, `closedAt` y `closedBy`.
4. El cierre queda en la bitácora como `FINDING_CLOSED`. No se agregan acciones nuevas a ese hallazgo ni se reabre una acción `DONE` vinculada después del cierre.

`PATCH /api/findings/:id/close` requiere JWT, `version` y `note` de 10–1,000 caracteres. Responde 404 si el hallazgo no existe o no es visible, 403 para rol no autorizado, 400 para entrada inválida y 409 si falta una acción terminada, queda una acción sin terminar o cambió la versión. Auditor solo puede cerrar los hallazgos de riesgos propios; Gerente y Super Admin pueden gestionarlos. No se conceden permisos a Dirección o Jefatura.

## Evidencia y límites

`backend/tests/findings.integration.test.js` prueba ausencia de plan, acción abierta, acción terminada, permisos, validación, doble cierre y prohibición de reabrir. `backend/tests/supabaseFindings.test.js` comprueba el adaptador de persistencia; `frontend/e2e/finding-closure.spec.js` prueba el flujo visual con respuestas simuladas. TC-48, TC-49 y TC-50 se relacionan con esas pruebas, sin dictamen desplegado por ese vínculo.

No se añadió migración: `vera_findings.payload` y `version` admiten el estado y la actualización con control de versión. Como la lectura de acciones y la escritura del hallazgo no están en una sola transacción de base de datos, debe ejecutarse una prueba de concurrencia sobre Supabase antes de prometer cierre atómico ante cambios simultáneos.
