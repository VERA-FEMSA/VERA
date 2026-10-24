const userRepository = require("../repositories/userRepository");
const roleRequests = require("../repositories/roleRequestRepository");
const { prepareRoleRequest, createRoleRequestForUser } = require("./roleRequestService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  .replace(/^[¿?!.]+|[¿?!.]+$/g, "").replace(/\s+/g, " ");
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });
const ROLE_NAMES = { director: "DIRECTOR", gerente: "GERENTE", jefatura: "JEFATURA",
  auditor: "AUDITOR" };
const isRoleRequestCommand = (question) => /^(?:solicita|solicitar|pide|pedir)\s+(?:el\s+)?rol\b/i.test(question) ||
  /^(?:mis solicitudes de rol|que rol tengo|cual es mi rol|confirmar solicitud de rol)$/i.test(normalize(question));
const parseRequest = (question) => {
  const match = question.trim().match(/^(?:solicita|solicitar|pide|pedir)\s+(?:el\s+)?rol\s+(director|gerente|jefatura|auditor)\s+porque\s+(.+)$/i);
  return match ? { role: ROLE_NAMES[normalize(match[1])], reason: match[2].trim() } : null;
};

const handleRoleRequest = async (user, question, thread) => {
  if (!isRoleRequestCommand(question)) return null;
  const current = await userRepository.findById(user.id);
  if (!current || current.status !== "ACTIVE" || current.role !== user.role) {
    const error = new Error("Cambió tu acceso. Inicia sesión de nuevo."); error.status = 409; throw error;
  }
  const normalized = normalize(question);
  if (normalized === "que rol tengo" || normalized === "cual es mi rol") {
    return response(`Tu rol actual es ${current.role}. Puedes pedir un cambio escribiendo «Solicita rol gerente porque necesito gestionar riesgos del portafolio». La solicitud no cambia tus permisos hasta que SUPER_ADMIN la autorice.`);
  }
  if (normalized === "mis solicitudes de rol") {
    const requests = await roleRequests.listMine(current.id);
    return response(requests.length ? `Tus solicitudes recientes: ${requests.slice(0, 10).map((item) =>
      `#${item.id}: ${item.requestedRole}, ${item.status}, ${new Date(item.createdAt).toLocaleDateString("es-MX")}`).join("; ")}.`
      : "Todavía no tienes solicitudes de cambio de rol.");
  }
  if (normalized === "confirmar solicitud de rol") {
    const draft = thread.messages.at(-1)?.actionDraft;
    if (!draft || draft.type !== "ROLE_REQUEST") {
      return response("No hay una solicitud de rol pendiente de confirmación. Pide una vista previa nueva.");
    }
    if (Date.parse(draft.expiresAt) < Date.now()) {
      return response("La vista previa venció. Solicita el cambio de rol de nuevo.");
    }
    const alreadySent = (await roleRequests.listMine(current.id)).find((item) =>
      item.requestedRole === draft.role && item.reason === draft.reason &&
      Date.parse(item.createdAt) >= Date.parse(draft.preparedAt) - 1000);
    if (alreadySent) {
      return response(`La solicitud #${alreadySent.id} para ${alreadySent.requestedRole} ya fue enviada. Estado: ${alreadySent.status}. Tus permisos solo cambian tras la aprobación.`,
        "action-executed", { actionOutcome: { id: alreadySent.id, status: alreadySent.status } });
    }
    try {
      const request = await createRoleRequestForUser(user, draft.role, draft.reason, draft.fromRole);
      return response(`Envié la solicitud #${request.id} para el rol ${request.requestedRole}. Sigue en revisión; tus permisos actuales no cambiaron.`,
        "action-executed", { actionOutcome: { id: request.id, status: request.status } });
    } catch (error) {
      if (error.status) return response(`${error.message} Consulta «Mis solicitudes de rol» para revisar el estado.`);
      throw error;
    }
  }
  const parsed = parseRequest(question);
  if (!parsed) return response("Para pedir un cambio, escribe «Solicita rol gerente porque necesito gestionar riesgos del portafolio». Roles disponibles: Auditor, Jefatura, Gerente y Director; describe el motivo en 10 a 500 caracteres.");
  try {
    const prepared = await prepareRoleRequest(user, parsed.role, parsed.reason);
    const draft = { type: "ROLE_REQUEST", fromRole: prepared.current.role, role: prepared.requestedRole,
      reason: prepared.reason, preparedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
    return response(`Vas a solicitar el cambio de ${prepared.current.role} a ${prepared.requestedRole}. Motivo: ${prepared.reason}. No tendrás permisos nuevos hasta que SUPER_ADMIN apruebe la solicitud. Escribe «Confirmar solicitud de rol» en los próximos cinco minutos; cualquier otra pregunta descarta esta vista previa.`,
      "action-preview", { actionDraft: draft });
  } catch (error) {
    if (error.status) return response(error.message);
    throw error;
  }
};

module.exports = { isRoleRequestCommand, parseRequest, handleRoleRequest };
