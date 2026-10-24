const { randomUUID } = require("node:crypto");
const userRepository = require("../repositories/userRepository");
const planningRepository = require("../repositories/planningRepository");
const { PLANNING_APPROVE_ROLES } = require("../config/roles");
const { EDITABLE_FIELDS_BY_STATUS, FIELD_LABELS } = require("../config/auditEditRules");
const { prepareAuditEdit } = require("./auditEditService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const fields = { objetivo: "objective", responsable: "responsibleId", trimestre: "quarter",
  "fecha de inicio": "startDate", "fecha de fin": "endDate", probabilidad: "likelihood", impacto: "impact" };
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });
const parseCommand = (question) => {
  const match = String(question || "").trim().match(/^edita la auditor[ií]a\s+(\S+):\s*([^=]{3,30})\s*=\s*«([^»]{1,650})»\s+porque\s+(.{10,300})$/i);
  if (!match) return null;
  return { id: match[1], field: fields[normalize(match[2])], value: match[3].trim(), reason: match[4].trim() };
};
const intent = (question) => /^edita la auditor[ií]a\b/i.test(String(question || "").trim()) ||
  normalize(question) === "confirmar edicion de auditoria";

const handleAuditEdit = async (user, question, thread) => {
  if (!intent(question)) return null;
  const currentUser = await userRepository.findById(user.id);
  if (!currentUser || currentUser.status !== "ACTIVE" || currentUser.role !== user.role) {
    return response("Cambió tu acceso. Inicia sesión de nuevo.");
  }
  if (!PLANNING_APPROVE_ROLES.includes(user.role)) {
    return response("Tu rol puede consultar auditorías, pero no editar sus datos.");
  }
  if (normalize(question) === "confirmar edicion de auditoria") {
    const reservation = thread.messages.at(-1)?.actionReservation;
    if (reservation?.type === "AUDIT_EDIT") {
      const audit = await planningRepository.findById(reservation.id);
      return audit?.aiEditOperationId === reservation.operationId
        ? response(`La edición de ${reservation.id} ya quedó registrada.`, "action-executed",
          { actionOutcome: { id: audit.id } })
        : response("La confirmación sigue en curso o cambió fuera del chat. Consulta el expediente antes de intentarlo otra vez.",
          "action-pending");
    }
    const draft = thread.messages.at(-1)?.actionDraft;
    if (draft?.type !== "AUDIT_EDIT") return response("No hay una edición pendiente de confirmar.");
    if (Date.parse(draft.expiresAt) < Date.now()) return response("La vista previa venció. Prepara una edición nueva.");
    try { await prepareAuditEdit(user, draft.id, { [draft.field]: draft.value }, draft.expected); }
    catch (error) { if (error.status) return response(error.message); throw error; }
    return response("Reservando la edición de auditoría.", "action-reservation", { auditEdit: draft });
  }
  const parsed = parseCommand(question);
  if (!parsed?.field) {
    return response("Usa «Edita la auditoría AUD-01: objetivo = «Nuevo objetivo» porque cambió el alcance». Campos posibles según estado: objetivo, responsable (ID numérico), trimestre, fechas, probabilidad e impacto.");
  }
  let prepared;
  try { prepared = await prepareAuditEdit(user, parsed.id, { [parsed.field]: parsed.value }); }
  catch (error) { if (error.status) return response(error.message); throw error; }
  if (!EDITABLE_FIELDS_BY_STATUS[prepared.current.status]?.includes(parsed.field)) {
    return response("Ese campo no puede cambiarse en el estado actual.");
  }
  const before = prepared.current[parsed.field] || "(vacío)";
  const after = parsed.field === "responsibleId" ? `${parsed.value} (${prepared.update.responsible})` : parsed.value;
  const draft = { type: "AUDIT_EDIT", id: prepared.current.id, field: parsed.field,
    value: parsed.value, reason: parsed.reason,
    expected: { storageVersion: prepared.current.storageVersion, updatedAt: prepared.current.updatedAt,
      status: prepared.current.status, field: parsed.field, value: prepared.current[parsed.field] },
    operationId: randomUUID(), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  return response(`Revisa la auditoría ${parsed.id} (${prepared.current.title}), estado ${prepared.current.status}. ${FIELD_LABELS[parsed.field]}: «${before}» → «${after}». Motivo: ${parsed.reason}. Escribe «Confirmar edición de auditoría» en cinco minutos; otra pregunta descarta la vista previa.`,
    "action-preview", { actionDraft: draft });
};

module.exports = { parseCommand, intent, handleAuditEdit };
