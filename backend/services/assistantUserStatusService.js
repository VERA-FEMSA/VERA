const { randomUUID } = require("node:crypto");
const { prepareUserStatus } = require("./userStatusService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });
const parse = (question) => {
  const command = normalize(question);
  if (command === "confirmar cambio de cuenta") return { confirm: true };
  const match = String(question || "").trim().match(/^(habilita|habilitar|deshabilita|deshabilitar) cuenta #?(\d+)(?: porque (.+))?$/i);
  return match ? { active: normalize(match[1]).startsWith("h"), id: Number(match[2]),
    reason: match[3]?.trim() || "" } : null;
};
const intent = (question) => Boolean(parse(question));

const handleUserStatus = async (user, question, thread) => {
  const command = parse(question);
  if (!command) return null;
  if (command.confirm) {
    const reservation = thread.messages.at(-1)?.actionReservation;
    if (reservation?.type === "USER_STATUS") {
      return response("El cambio ya se intentó. Consulta el directorio y la bitácora antes de solicitar otra vista previa.");
    }
    const draft = thread.messages.at(-1)?.actionDraft;
    if (draft?.type !== "USER_STATUS") return response("No hay un cambio de cuenta pendiente. Solicita una vista previa nueva.");
    if (Date.parse(draft.expiresAt) < Date.now()) return response("La vista previa venció. Solicita una nueva.");
    try { await prepareUserStatus(user, draft.id,
      { status: draft.expectedStatus, version: draft.expectedVersion }); }
    catch (error) { if (error.status) return response(error.message); throw error; }
    return response("Reservando el cambio de cuenta.", "action-reservation", { userStatus: draft });
  }
  if (!Number.isSafeInteger(command.id) || command.id < 1) return response("ID de cuenta inválido.");
  if (command.reason.length < 10 || command.reason.length > 300) {
    return response("Indica el motivo en 10 a 300 caracteres: «Deshabilita cuenta #5 porque terminó su acceso al proyecto».");
  }
  let target;
  try { target = await prepareUserStatus(user, command.id); }
  catch (error) { if (error.status) return response(error.message); throw error; }
  if (target.status === (command.active ? "ACTIVE" : "DISABLED")) {
    return response(`La cuenta #${target.id} ya está ${command.active ? "habilitada" : "deshabilitada"}.`);
  }
  const draft = { type: "USER_STATUS", id: target.id, active: command.active, reason: command.reason,
    expectedStatus: target.status, expectedVersion: target.storageVersion,
    operationId: randomUUID(), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  return response(`Revisa el cambio: cuenta #${target.id}, ${target.name || target.username} (${target.email}), rol ${target.role}, estado actual ${target.status}. ${command.active ? "Habilitar" : "Deshabilitar"} afectará su acceso. Motivo: ${command.reason}. Escribe «Confirmar cambio de cuenta» en los próximos cinco minutos; otra pregunta descarta esta vista previa.`,
    "action-preview", { actionDraft: draft });
};

module.exports = { parse, intent, handleUserStatus };
