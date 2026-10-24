const userRepository = require("../repositories/userRepository");
const { prepareProposalEdit, updateProposalForUser } = require("./proposalService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });
const FIELDS = { titulo: "title", objetivo: "objective", alcance: "scope",
  justificacion: "justification", area: "area" };
const isProposalEditCommand = (question) => /^(?:edita|editar|cambia|cambiar)\s+(?:la\s+)?propuesta\b/i.test(question) ||
  normalize(question) === "confirmar edicion de propuesta";
const parseProposalEdit = (question) => {
  const match = question.trim().match(/^(?:edita|editar|cambia|cambiar)\s+(?:la\s+)?propuesta\s+(AUD-[a-z0-9-]+)\s*:\s*(t[ií]tulo|objetivo|alcance|justificaci[oó]n|[aá]rea)\s*=\s*[«“"](.+?)[»”"]\s+porque\s+(.+)$/i);
  return match ? { id: match[1], field: FIELDS[normalize(match[2])], value: match[3].trim(),
    reason: match[4].trim() } : null;
};

const handleProposalEdit = async (user, question, thread) => {
  if (!isProposalEditCommand(question)) return null;
  const currentUser = await userRepository.findById(user.id);
  if (currentUser?.status !== "ACTIVE" || currentUser.role !== user.role) {
    const error = new Error("Cambió tu acceso. Inicia sesión de nuevo."); error.status = 409; throw error;
  }
  if (normalize(question) === "confirmar edicion de propuesta") {
    const draft = thread.messages.at(-1)?.actionDraft;
    if (!draft || draft.type !== "PROPOSAL_EDIT") {
      return response("No hay una edición de propuesta pendiente. Solicita una vista previa nueva.");
    }
    if (Date.parse(draft.expiresAt) < Date.now()) return response("La vista previa venció. Solicita la edición de nuevo.");
    try {
      const proposal = await updateProposalForUser(user, draft.id, { [draft.field]: draft.value },
        draft.version, draft.reason, { [draft.field]: draft.before });
      return response(`Actualicé ${draft.label} de la propuesta «${proposal.title}» (${proposal.id}). Motivo registrado: ${draft.reason}.`,
        "action-executed", { actionOutcome: { id: proposal.id, status: proposal.status } });
    } catch (error) {
      if (error.status) return response(`${error.message} Consulta la propuesta antes de intentarlo otra vez.`);
      throw error;
    }
  }
  const parsed = parseProposalEdit(question);
  if (!parsed || parsed.value.length < 3 || parsed.value.length > 500 ||
      parsed.reason.length < 10 || parsed.reason.length > 500) {
    return response("Indica ID, campo, valor y motivo. Ejemplo: Edita la propuesta AUD-04: objetivo = «Revisar controles de acceso» porque cambió el alcance acordado. Por ahora puedes editar título, objetivo, alcance, justificación y área; el valor debe tener 3–500 caracteres y el motivo 10–500.");
  }
  try {
    const { current } = await prepareProposalEdit(user, parsed.id, { [parsed.field]: parsed.value });
    const label = Object.keys(FIELDS).find((key) => FIELDS[key] === parsed.field);
    const draft = { type: "PROPOSAL_EDIT", id: current.id, field: parsed.field, label,
      before: current[parsed.field], value: parsed.value, reason: parsed.reason, version: current.storageVersion,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
    return response(`Vas a cambiar ${label} de la propuesta «${current.title}» (${current.id}). Antes: «${current[parsed.field]}». Después: «${parsed.value}». Motivo: ${parsed.reason}. Escribe «Confirmar edición de propuesta» en los próximos cinco minutos; cualquier otra pregunta descarta esta vista previa.`,
      "action-preview", { actionDraft: draft });
  } catch (error) {
    if (error.status) return response(error.message);
    throw error;
  }
};

module.exports = { isProposalEditCommand, parseProposalEdit, handleProposalEdit };
