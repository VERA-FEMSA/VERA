const userRepository = require("../repositories/userRepository");
const { RECORD_CREATE_ROLES } = require("../config/roles");
const { visibleNotifications, prepareReadChange } = require("./notificationWorkflowService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });
const intent = (question) => /^(?:mis avisos|avisos sin leer|siguientes avisos|confirmar lectura)$/i.test(normalize(question)) ||
  /^marca (?:leida|sin leer) la notificacion\s+\S+$/i.test(normalize(question));
const parseChange = (question) => {
  const match = question.trim().match(/^marca (le[ií]da|sin leer) la notificaci[oó]n\s+(\S+)$/i);
  return match ? { read: normalize(match[1]) === "leida", id: match[2] } : null;
};

const handleNotification = async (user, question, thread) => {
  if (!intent(question)) return null;
  const current = await userRepository.findById(user.id);
  if (!current || current.status !== "ACTIVE" || current.role !== user.role) {
    return response("Cambió tu acceso. Inicia sesión de nuevo.");
  }
  const command = normalize(question);
  if (["mis avisos", "avisos sin leer", "siguientes avisos"].includes(command)) {
    const result = await visibleNotifications(user);
    const unreadOnly = command === "avisos sin leer" ||
      command === "siguientes avisos" && thread.messages.at(-1)?.notificationBrowse?.unreadOnly;
    const items = result.notifications.filter((item) => !unreadOnly || !item.readAt);
    const previous = thread.messages.at(-1)?.notificationBrowse;
    const offset = command === "siguientes avisos" && previous?.type === "NOTIFICATIONS" ? previous.offset : 0;
    const page = items.slice(offset, offset + 5);
    const partial = !result.actionAlertsAvailable;
    if (!page.length) return response(offset ? "No hay más avisos en esta lista. Escribe «Mis avisos» para actualizarla."
      : "No hay avisos visibles para este filtro.", "action-guidance", { coverage: { partial } });
    return response(`${unreadOnly ? "Avisos sin leer" : "Avisos visibles"}: ${items.length}; mostrando ${offset + 1} a ${offset + page.length}. ${page.map((item) =>
      `${item.id}: ${item.title}; ${item.readAt ? "leída" : "sin leer"}; ${item.description}.`).join(" ")}${partial ? " Los avisos de compromisos están temporalmente incompletos." : ""} ${RECORD_CREATE_ROLES.includes(user.role) ? "Para cambiar lectura escribe «Marca leída la notificación ID» o «Marca sin leer la notificación ID»." : "Tu rol puede consultarlos, pero no cambiar su lectura."}${offset + page.length < items.length ? " Escribe «Siguientes avisos» para continuar." : ""}`,
    "action-guidance", { coverage: { partial }, references: page.map((item) => ({ id: item.id, title: item.title,
      path: item.path })), notificationBrowse: { type: "NOTIFICATIONS", offset: offset + page.length, unreadOnly } });
  }
  if (!RECORD_CREATE_ROLES.includes(user.role)) {
    return response("Tu rol puede consultar avisos, pero no cambiar su lectura.");
  }
  if (command === "confirmar lectura") {
    const reservation = thread.messages.at(-1)?.actionReservation;
    if (reservation?.type === "NOTIFICATION_READ") {
      const currentItem = await prepareReadChange(user, reservation.id, reservation.read);
      return Boolean(currentItem.readAt) === reservation.read
        ? response(`La notificación ${reservation.id} ya está ${reservation.read ? "leída" : "sin leer"}.`,
          "action-executed", { actionOutcome: { id: reservation.id } })
        : response("La confirmación sigue en curso o cambió fuera del chat. Consulta el aviso antes de intentarlo otra vez.",
          "action-pending");
    }
    const draft = thread.messages.at(-1)?.actionDraft;
    if (draft?.type !== "NOTIFICATION_READ") return response("No hay una lectura pendiente de confirmar.");
    if (Date.parse(draft.expiresAt) < Date.now()) return response("La vista previa venció. Solicítala de nuevo.");
    try {
      const item = await prepareReadChange(user, draft.id, draft.read);
      if (item.readAt !== draft.expectedReadAt) return response("El aviso cambió desde la vista previa. Revísalo otra vez.");
    } catch (error) { if (error.status) return response(error.message); throw error; }
    return response("Reservando el cambio de lectura.", "action-reservation", { notificationRead: draft });
  }
  const change = parseChange(question);
  if (!change) return response("Usa «Mis avisos», elige el ID exacto y escribe «Marca leída la notificación ID».");
  let item;
  try { item = await prepareReadChange(user, change.id, change.read); }
  catch (error) { if (error.status) return response(error.message); throw error; }
  if (Boolean(item.readAt) === change.read) {
    return response(`La notificación ${item.id} ya está ${change.read ? "leída" : "sin leer"}.`);
  }
  const draft = { type: "NOTIFICATION_READ", id: item.id, read: change.read,
    expectedReadAt: item.readAt, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  return response(`Revisa «${item.title}» (${item.id}). La lectura cambiará de ${item.readAt ? "leída" : "sin leer"} a ${change.read ? "leída" : "sin leer"}. Esto no completa ni modifica la tarea. Escribe «Confirmar lectura» en cinco minutos; otra pregunta descarta la vista previa.`,
    "action-preview", { actionDraft: draft });
};

module.exports = { intent, parseChange, handleNotification };
