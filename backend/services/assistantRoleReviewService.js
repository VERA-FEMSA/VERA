const userRepository = require("../repositories/userRepository");
const roleRequests = require("../repositories/roleRequestRepository");
const { pendingRoleReviewsForUser, prepareRoleReview } = require("./roleRequestService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });
const intent = (question) => /^(?:solicitudes de rol pendientes|siguientes solicitudes de rol)$/i.test(normalize(question)) ||
  /^(?:aprueba|aprobar|rechaza|rechazar) solicitud de rol\s*#?\d+$/i.test(normalize(question)) ||
  /^confirmar revision de rol$/i.test(normalize(question));
const parseDecision = (question) => {
  const match = normalize(question).match(/^(aprueba|aprobar|rechaza|rechazar) solicitud de rol\s*#?(\d+)$/);
  return match ? { approve: /^apr(?:ue|ob)/.test(match[1]), requestId: Number(match[2]) } : null;
};

const handleRoleReview = async (user, question, thread) => {
  if (!intent(question)) return null;
  const current = await userRepository.findById(user.id);
  if (!current || current.status !== "ACTIVE" || current.role !== user.role || user.role !== "SUPER_ADMIN") {
    return response("Solo una cuenta Super Admin activa puede revisar solicitudes de rol.");
  }
  const command = normalize(question);
  if (command === "solicitudes de rol pendientes" || command === "siguientes solicitudes de rol") {
    const pending = (await pendingRoleReviewsForUser(user)).sort((a, b) => a.request.id - b.request.id);
    if (!pending.length) return response("No hay solicitudes de rol pendientes.");
    const previous = thread.messages.at(-1)?.roleReviewBrowse;
    const afterId = command === "siguientes solicitudes de rol" && previous?.type === "ROLE_REVIEWS"
      ? previous.afterId : 0;
    const remaining = pending.filter(({ request }) => request.id > afterId);
    if (!remaining.length) return response("Ya no hay más solicitudes pendientes en esta lista. Escribe «Solicitudes de rol pendientes» para actualizarla.");
    const page = remaining.slice(0, 5);
    return response(`Hay ${pending.length} solicitudes pendientes; mostrando hasta cinco desde el ID #${page[0].request.id}. ${page.map(({ request, target }) =>
      `#${request.id}: ${target?.name || target?.username || "Cuenta no disponible"} (${target?.role || "sin rol"} → ${request.requestedRole}); motivo: ${request.reason}.`).join(" ")} Para decidir una, escribe «Aprueba solicitud de rol #ID» o «Rechaza solicitud de rol #ID».${remaining.length > page.length ? " Escribe «Siguientes solicitudes de rol» para continuar." : ""}`,
    "action-guidance", { roleReviewBrowse: { type: "ROLE_REVIEWS", afterId: page.at(-1).request.id } });
  }
  if (command === "confirmar revision de rol") {
    const reservation = thread.messages.at(-1)?.actionReservation;
    if (reservation?.type === "ROLE_REVIEW") {
      const mine = await roleRequests.listMine(reservation.userId);
      const reviewed = mine.find((item) => item.id === reservation.requestId &&
        item.reviewedBy === user.id && item.status === (reservation.approve ? "APPROVED" : "REJECTED"));
      return reviewed ? response(`La solicitud #${reviewed.id} ya figura como ${reviewed.status}. Consulta la lista para ver las pendientes.`,
        "action-executed", { actionOutcome: { id: reviewed.id, status: reviewed.status } })
        : response("La revisión sigue en curso o cambió fuera del chat. Consulta las solicitudes antes de intentar otra decisión.", "action-pending");
    }
    const draft = thread.messages.at(-1)?.actionDraft;
    if (draft?.type !== "ROLE_REVIEW") return response("No hay una revisión pendiente. Solicita una vista previa nueva.");
    if (Date.parse(draft.expiresAt) < Date.now()) return response("La vista previa venció. Solicita una nueva.");
    try { await prepareRoleReview(user, draft.requestId, draft.targetRole); }
    catch (error) { if (error.status) return response(error.message); throw error; }
    return response("Reservando la revisión de rol.", "action-reservation", { roleReview: draft });
  }
  const decision = parseDecision(question);
  if (!decision || !Number.isSafeInteger(decision.requestId) || decision.requestId < 1) {
    return response("Usa «Solicitudes de rol pendientes» y después «Aprueba solicitud de rol #ID» o «Rechaza solicitud de rol #ID».");
  }
  let item;
  try { item = await prepareRoleReview(user, decision.requestId); }
  catch (error) { if (error.status) return response(error.message); throw error; }
  const { request, target } = item;
  const draft = { type: "ROLE_REVIEW", requestId: request.id, userId: target.id,
    targetRole: target.role, requestedRole: request.requestedRole, approve: decision.approve,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  return response(`Revisa la decisión: solicitud #${request.id} de ${target.name || target.username}; rol actual ${target.role}; rol solicitado ${request.requestedRole}; motivo: ${request.reason}. ${decision.approve ? "Aprobar cambia sus permisos" : "Rechazar conserva sus permisos"}. Escribe «Confirmar revisión de rol» en los próximos cinco minutos; otra pregunta descarta esta vista previa.`,
    "action-preview", { actionDraft: draft });
};

module.exports = { intent, parseDecision, handleRoleReview };
