const { RISK_CONTROL_MANAGE_ROLES, PLANNING_APPROVE_ROLES, RECORD_CREATE_ROLES,
  AUDIT_PROPOSAL_CREATE_ROLES } = require("../config/roles");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/^[¿?!.]+|[¿?!.]+$/g, "").replace(/\s+/g, " ");
const isCapabilityQuestion = (question) => /^(?:ayuda|que (?:puedes|puedo) hacer(?: aqui| con vera)?|(?:muestrame|muestra) (?:las )?(?:opciones|capacidades|comandos)(?: del chat)?|como (?:uso|funciona) (?:el )?asistente)$/.test(normalize(question));

const capabilityAnswer = (user, persistent) => {
  const lines = [
    "Puedo ayudarte aquí mismo con las funciones disponibles para tu cuenta:",
    "• Consultar auditorías, propuestas, riesgos, controles, hallazgos y pendientes. Pide «siguientes» para continuar una lista.",
    "• Resumir el portafolio y preparar su CSV: «Exporta el reporte del portafolio en CSV»."
  ];
  if (persistent) {
    lines.push("• Recorrer un expediente sin salir del chat: «Detalles de la auditoría AUD-01» y después «Más riesgos de la auditoría AUD-01» u otra relación.");
  }
  if (persistent) {
    lines.push("• Revisar tus avisos aquí mismo: «Mis avisos», «Avisos sin leer» y «Siguientes avisos».");
  }
  if (process.env.VERA_AI_ATTACHMENTS_ENABLED === "true") {
    lines.push("• Analizar un archivo privado que adjuntes a la conversación y señalar las fuentes disponibles.");
  }
  if (!persistent) {
    lines.push("Para registrar cambios con confirmación, inicia una conversación guardada. Esta consulta sin historial sólo lee.");
    return lines.join("\n");
  }
  if (user.role !== "SUPER_ADMIN") {
    lines.push("• Consultar tu rol, pedir un cambio con motivo y seguir el estado: «Qué rol tengo» o «Mis solicitudes de rol».");
  } else {
    lines.push("• Revisar solicitudes de rol: «Solicitudes de rol pendientes» y después aprobar o rechazar una por su ID, con vista previa y confirmación.");
  }
  if (RECORD_CREATE_ROLES.includes(user.role)) {
    lines.push("• Marcar un aviso visible como leído o sin leer, con vista previa y confirmación. La tarea de origen no se completa por ello.");
    lines.push("• Crear compromisos propios y cambiar el estado de los que puedas gestionar; primero mostraré una vista previa.");
    lines.push("• Registrar una referencia de evidencia vinculada a un riesgo, control o auditoría visible: escribe «Registrar evidencia».");
    if (process.env.VERA_AI_ATTACHMENTS_ENABLED === "true") {
      lines.push("• Vincular un archivo privado seleccionado como evidencia: «Vincula este archivo como evidencia»; revisarás el expediente antes de confirmar.");
    }
    lines.push("• Comentar una propuesta o auditoría visible: «Comenta la auditoría AUD-01: texto del comentario».");
  }
  if (AUDIT_PROPOSAL_CREATE_ROLES.includes(user.role)) {
    lines.push("• Crear una propuesta de auditoría: escribe «Crear propuesta» y completa los campos que pediré aquí mismo.");
    lines.push("• Editar título, objetivo, alcance, justificación o área de una propuesta abierta indicando ID, valor y motivo; revisa la vista previa antes de confirmar.");
  }
  if (PLANNING_APPROVE_ROLES.includes(user.role)) {
    lines.push("• Reasignar compromisos, aprobar o rechazar propuestas, e iniciar o cerrar auditorías, indicando expediente y motivo.");
  }
  if (RISK_CONTROL_MANAGE_ROLES.includes(user.role)) {
    lines.push("• Registrar riesgos nuevos: escribe «Registrar riesgo» y completa los campos aquí mismo.");
    lines.push("• Registrar controles vinculados con riesgos: escribe «Registrar control» y completa los campos aquí mismo.");
    lines.push("• Editar datos principales de un riesgo o control visible: «Edita el riesgo RSK-001: nombre = «Nuevo nombre» porque se actualizó el alcance». Revisarás el antes y el después.");
    lines.push("• Evaluar riesgos existentes con probabilidad e impacto de 1 a 3, y controles existentes con efectividad de 1 a 5, siempre con justificación.");
  }
  if (RISK_CONTROL_MANAGE_ROLES.includes(user.role) || user.role === "AUDITOR") {
    lines.push("• Registrar un hallazgo desde un control inefectivo vinculado a un riesgo permitido: escribe «Registrar hallazgo»; cerrarlo cuando sus acciones terminen con «Cierra el hallazgo FDG-… porque …».");
  }
  lines.push("Los cambios requieren una confirmación escrita después de revisar la vista previa. Si falta información o no tienes permiso, te lo diré sin ejecutar nada.");
  return lines.join("\n");
};
const handleCapabilityQuestion = (user, question, persistent) => isCapabilityQuestion(question)
  ? { answer: capabilityAnswer(user, persistent), mode: "action-guidance", citations: [], references: [],
    coverage: { partial: false }, asOf: new Date().toISOString(), usage: null } : null;

module.exports = { isCapabilityQuestion, capabilityAnswer, handleCapabilityQuestion };
