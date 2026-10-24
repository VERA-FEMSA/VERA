const { randomUUID } = require("node:crypto");
const riskRepository = require("../repositories/riskRepository");
const controlRepository = require("../repositories/controlRepository");
const userRepository = require("../repositories/userRepository");
const { RISK_CONTROL_MANAGE_ROLES } = require("../config/roles");
const { prepareRecordEdit } = require("./recordEditService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });
const names = { nombre: "title", descripcion: "description", area: "area",
  "plan de respuesta": "responsePlan", tipo: "type", frecuencia: "frequency" };
const fieldLabels = { title: "Nombre", description: "Descripción", area: "Área",
  responsePlan: "Plan de respuesta", type: "Tipo", frequency: "Frecuencia" };
const parseCommand = (question) => {
  const match = question.trim().match(/^Edita (?:el|la) (riesgo|control) (\S+):\s*([^=]{2,30})\s*=\s*«([^»]{1,650})»\s+porque\s+(.{10,300})$/i);
  if (!match) return null;
  return { type: normalize(match[1]) === "riesgo" ? "RISK" : "CONTROL", id: match[2],
    field: names[normalize(match[3])], value: match[4].trim(), reason: match[5].trim() };
};
const isRecordEditCommand = (question) => /^edita (?:el|la) (?:riesgo|control)\b/i.test(question) ||
  /^confirmar edicion de registro$/i.test(normalize(question));

const handleRecordEdit = async (user, question, thread) => {
  if (!isRecordEditCommand(question)) return null;
  const currentUser = await userRepository.findById(user.id);
  if (currentUser?.status !== "ACTIVE" || currentUser.role !== user.role) {
    const error = new Error("Cambió tu acceso. Inicia sesión de nuevo."); error.status = 409; throw error;
  }
  if (!RISK_CONTROL_MANAGE_ROLES.includes(user.role)) {
    return response("Tu rol puede consultar estos registros, pero no editar sus datos.");
  }
  if (normalize(question) === "confirmar edicion de registro") {
    const reservation = thread.messages.at(-1)?.actionReservation;
    if (reservation?.type === "RECORD_EDIT") {
      const repo = reservation.entityType === "RISK" ? riskRepository : controlRepository;
      const record = await repo.findById(reservation.entityId);
      return record?.aiEditOperationId === reservation.operationId
        ? response(`La edición de ${reservation.entityId} ya quedó registrada.`, "action-executed",
          { actionOutcome: { id: record.id } })
        : response("La confirmación sigue en curso o cambió fuera del chat. Consulta el expediente antes de intentar otra edición.", "action-pending");
    }
    const draft = thread.messages.at(-1)?.actionDraft;
    if (draft?.type !== "RECORD_EDIT") return response("No hay una edición pendiente. Pide una vista previa nueva.");
    if (Date.parse(draft.expiresAt) < Date.now()) return response("La vista previa venció. Prepara la edición de nuevo.");
    try {
      const prepared = await prepareRecordEdit(user, draft.entityType, draft.entityId, draft.field, draft.value);
      if (prepared.current.updatedAt !== draft.expected.updatedAt ||
          prepared.current[draft.field] !== draft.expected.value) {
        return response("El registro cambió desde la vista previa. Prepara otra edición.");
      }
    } catch (error) { if (error.status) return response(error.message); throw error; }
    return response("Reservando la edición del registro.", "action-reservation", { recordEdit: draft });
  }
  const parsed = parseCommand(question);
  if (!parsed || !parsed.field ||
      parsed.type === "RISK" && ["type", "frequency"].includes(parsed.field) ||
      parsed.type === "CONTROL" && ["area", "responsePlan"].includes(parsed.field)) {
    return response("Usa «Edita el riesgo RSK-001: nombre = «Nuevo nombre» porque motivo de al menos diez caracteres». Para controles: nombre, descripción, tipo o frecuencia. Para riesgos: nombre, descripción, área o plan de respuesta. Usa un ID visible y un valor concreto.");
  }
  let prepared;
  try { prepared = await prepareRecordEdit(user, parsed.type, parsed.id, parsed.field, parsed.value); }
  catch (error) { if (error.status) return response(error.message); throw error; }
  const draft = { type: "RECORD_EDIT", entityType: parsed.type, entityId: parsed.id,
    field: parsed.field, value: parsed.value, reason: parsed.reason,
    expected: { value: prepared.current[parsed.field], updatedAt: prepared.current.updatedAt },
    operationId: randomUUID(), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  return response(`Revisa la edición de ${parsed.type === "RISK" ? "riesgo" : "control"} ${parsed.id} (${prepared.current.title}). ${fieldLabels[parsed.field]}: «${prepared.current[parsed.field] || "(vacío)"}» → «${parsed.value}». Motivo: ${parsed.reason}. Escribe «Confirmar edición de registro» en cinco minutos; otra pregunta descarta la vista previa.`,
    "action-preview", { actionDraft: draft });
};

module.exports = { isRecordEditCommand, parseCommand, handleRecordEdit };
