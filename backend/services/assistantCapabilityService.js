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
  if (process.env.VERA_AI_ATTACHMENTS_ENABLED === "true") {
    lines.push("• Analizar un archivo privado que adjuntes a la conversación y señalar las fuentes disponibles.");
  }
  if (!persistent) {
    lines.push("Para registrar cambios con confirmación, inicia una conversación guardada. Esta consulta sin historial sólo lee.");
    return lines.join("\n");
  }
  if (user.role !== "SUPER_ADMIN") {
    lines.push("• Consultar tu rol, pedir un cambio con motivo y seguir el estado: «Qué rol tengo» o «Mis solicitudes de rol».");
  }
  if (RECORD_CREATE_ROLES.includes(user.role)) {
    lines.push("• Crear compromisos propios y cambiar el estado de los que puedas gestionar; primero mostraré una vista previa.");
  }
  if (AUDIT_PROPOSAL_CREATE_ROLES.includes(user.role)) {
    lines.push("• Crear una propuesta de auditoría: escribe «Crear propuesta» y completa los campos que pediré aquí mismo.");
  }
  if (PLANNING_APPROVE_ROLES.includes(user.role)) {
    lines.push("• Reasignar compromisos, aprobar o rechazar propuestas, e iniciar o cerrar auditorías, indicando expediente y motivo.");
  }
  if (RISK_CONTROL_MANAGE_ROLES.includes(user.role)) {
    lines.push("• Registrar riesgos nuevos: escribe «Registrar riesgo» y completa los campos aquí mismo.");
    lines.push("• Registrar controles vinculados con riesgos: escribe «Registrar control» y completa los campos aquí mismo.");
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
