const { listActions, getAction, changeStatus, canTransition } = require("./actionService");
const userRepository = require("../repositories/userRepository");
const { RECORD_CREATE_ROLES, PLANNING_APPROVE_ROLES } = require("../config/roles");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });

const parseCompletion = (question) => {
  const prefix = "(?:completa|completar|finaliza|finalizar|marca|marcar|cierra|cerrar)\\s+(?:el\\s+)?compromiso\\s+";
  const quoted = new RegExp(`^${prefix}[\"“«](.+?)[\"”»]\\s+(?:como\\s+(?:completado|terminado)\\s+)?(?:porque|motivo\\s*:)\\s+(.+)$`, "i");
  const plain = new RegExp(`^${prefix}(.+?)\\s+(?:como\\s+(?:completado|terminado)\\s+)?(?:porque|motivo\\s*:)\\s+(.+)$`, "i");
  const match = question.match(quoted) || question.match(plain);
  return match ? { target: match[1].trim(), note: match[2].trim() } : null;
};

const STATUS_COMMANDS = [
  { status: "DONE", label: "completar", result: "completado" },
  { status: "IN_PROGRESS", verbs: "inicia|iniciar|empieza|empezar", label: "poner en curso", result: "en curso" },
  { status: "OPEN", verbs: "reabre|reabrir", label: "reabrir", result: "reabierto" },
  { status: "CANCELLED", verbs: "cancela|cancelar", label: "cancelar", result: "cancelado" }
];
const parseStatusChange = (question) => {
  const complete = parseCompletion(question);
  if (complete) return { ...complete, status: "DONE" };
  for (const item of STATUS_COMMANDS.slice(1)) {
    const prefix = "^(?:" + item.verbs + ")\\s+(?:el\\s+)?compromiso\\s+";
    const tail = "\\s+(?:porque|motivo\\s*:)\\s+(.+)$";
    const quoted = new RegExp(prefix + '["“«](.+?)["”»]' + tail, "i");
    const plain = new RegExp(prefix + "(.+?)" + tail, "i");
    const match = question.match(quoted) || question.match(plain);
    if (match) return { target: match[1].trim(), note: match[2].trim(), status: item.status };
  }
  return null;
};
const statusDescription = (status) => STATUS_COMMANDS.find((item) => item.status === status);

const confirm = (question) => /^(confirmar cambio|confirmo el cambio)$/i.test(question.trim());
const listRequest = (question) => /^(?:muestrame|lista|dame|ver)\s+(?:mis|los|todos los)\s+compromisos(?:\s+(?:abiertos|pendientes|cerrados|completados|cancelados))?$/
  .test(normalize(question));
const nextRequest = (question, thread) => /^(siguientes compromisos|mas compromisos)$/.test(normalize(question)) &&
  thread.messages.at(-1)?.browse?.type === "action-commitments" &&
  thread.messages.at(-1)?.browse?.hasMore === true;

const listCommitments = async (user, question, thread) => {
  const previous = thread.messages.at(-1)?.browse;
  const isNext = nextRequest(question, thread);
  const offset = isNext ? Math.min(previous.offset + 10, 1000) : 0;
  const mine = isNext ? previous.mine : /\bmis\b/.test(normalize(question));
  const filter = isNext ? previous.filter || "OPEN" : /\bcerrados\b/.test(normalize(question)) ? "CLOSED"
    : /\bcompletados\b/.test(normalize(question)) ? "DONE"
    : /\bcancelados\b/.test(normalize(question)) ? "CANCELLED" : "OPEN";
  const visible = (await listActions(user)).filter((item) =>
    (filter === "OPEN" ? ["OPEN", "IN_PROGRESS"].includes(item.status)
      : filter === "CLOSED" ? ["DONE", "CANCELLED"].includes(item.status) : item.status === filter) &&
    (!mine || item.assigneeId === user.id));
  const rows = visible.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) ||
    String(a.id).localeCompare(String(b.id)));
  const items = rows.slice(offset, offset + 10).map((item) => ({ sourceId: `action:${item.id}`,
    type: "Compromiso", id: item.id, title: item.title,
    path: `/notificaciones?actionId=${encodeURIComponent(item.id)}`,
    facts: [{ label: "Identificador", value: item.id }, { label: "Estado", value: item.status },
      { label: "Origen", value: item.sourceTitle },
      { label: "Responsable", value: item.assigneeName }, { label: "Vence", value: item.dueDate }] }));
  const hasMore = offset + items.length < rows.length;
  return response(rows.length
    ? `Hay ${rows.length} compromisos ${filter === "OPEN" ? "abiertos" : filter === "DONE" ? "completados" : filter === "CLOSED" ? "cerrados" : "cancelados"} ${mine ? "asignados a ti" : "visibles para tu cuenta"}. Muestro ${offset + 1}–${offset + items.length}.${hasMore ? " Escribe «siguientes compromisos» para continuar." : ""} Puedes pedir un cambio de estado por título o identificador y explicar el motivo.`
    : "No encontré compromisos con ese estado en tu alcance.", "browse",
  { browse: { type: "action-commitments", offset, mine, filter, total: rows.length, hasMore, items } });
};

const handleAssistantAction = async (user, question, thread) => {
  const command = parseStatusChange(question);
  const listing = listRequest(question) || nextRequest(question, thread);
  if (!command && !confirm(question) && !listing) return null;
  const current = await userRepository.findById(user.id);
  if (current?.status !== "ACTIVE" || current.role !== user.role) {
    const error = new Error("Cambió tu acceso. Inicia sesión de nuevo."); error.status = 409; throw error;
  }
  if (listing) return listCommitments(user, question, thread);
  if (!RECORD_CREATE_ROLES.includes(user.role)) {
    return response("Tu rol no puede actualizar compromisos. Puedes consultarlos desde esta conversación.");
  }

  if (confirm(question)) {
    const draft = thread.messages.at(-1)?.actionDraft;
    if (!draft || draft.type !== "ACTION_STATUS_CHANGE") {
      return response("No hay un cambio pendiente de confirmación. Primero indica qué compromiso deseas actualizar y por qué.");
    }
    if (Date.parse(draft.expiresAt) < Date.now()) {
      return response("La confirmación venció. Vuelve a pedir el cambio para revisar el estado actual.");
    }
    const action = await getAction(user, draft.id);
    if (action.storageVersion !== draft.version || !canTransition(action.status, draft.status)) {
      return response(action.status === draft.status
        ? "El compromiso ya figura con el estado solicitado. Revisa su bitácora para confirmar quién y cuándo registró el cambio."
        : "El compromiso cambió desde la vista previa. Pide el cambio otra vez para revisar su estado actual.");
    }
    const updated = await changeStatus(user, draft.id,
      { status: draft.status, note: draft.note, version: draft.version });
    return response(`Quedó ${statusDescription(draft.status).result} el compromiso «${updated.title}». El cambio y su motivo se registraron en la bitácora.`,
      "action-executed", { actionOutcome: { id: updated.id, status: updated.status } });
  }

  if (command.target.length > 140 || command.note.length < 10 || command.note.length > 1000) {
    return response("Escribe el título o identificador del compromiso y un motivo de 10 a 1,000 caracteres. Por ejemplo: Completa el compromiso «Revisar evidencia» porque la revisión quedó documentada.");
  }
  const actions = await listActions(user);
  const matches = actions.filter((action) => canTransition(action.status, command.status) &&
    (normalize(action.title) === normalize(command.target) || normalize(action.id) === normalize(command.target)));
  if (matches.length === 0) {
    return response("No encontré un compromiso con ese título o identificador y una transición válida en tu alcance. Consulta tus compromisos en el chat y copia su título exacto.");
  }
  if (matches.length > 1) {
    const options = matches.slice(0, 5).map((item) => `${item.id} · ${item.sourceTitle}`).join("; ");
    return response(`Hay varios compromisos con ese título. Repite la instrucción con uno de estos identificadores: ${options}.`);
  }
  const action = matches[0];
  if (action.assigneeId !== user.id && !PLANNING_APPROVE_ROLES.includes(user.role)) {
    return response("Puedes consultar ese compromiso, pero tu rol no puede cambiar su estado.");
  }
  const draft = { type: "ACTION_STATUS_CHANGE", id: action.id, status: command.status, version: action.storageVersion,
    note: command.note, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  return response(`Revisa antes de ejecutar: ${statusDescription(command.status).label} «${action.title}» (${action.sourceTitle}). Motivo: ${command.note}. Escribe «Confirmar cambio» en los próximos cinco minutos para registrarlo; cualquier otra pregunta descarta esta vista previa.`,
    "action-preview", { actionDraft: draft });
};

module.exports = { handleAssistantAction, parseCompletion, parseStatusChange, isCommitmentList: listRequest,
  isActionCommand: (question) =>
  Boolean(parseStatusChange(question) || confirm(question) || listRequest(question)) };
