const { randomUUID } = require("node:crypto");
const userRepository = require("../repositories/userRepository");
const { AUDIT_PROPOSAL_CREATE_ROLES } = require("../config/roles");
const { activeAuditors, parseProposal } = require("./proposalService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const response = (answer, mode = "action-guidance", extra = {}) => ({ answer, mode,
  citations: [], references: [], coverage: { partial: false }, asOf: new Date().toISOString(),
  usage: null, ...extra });
const intent = (question) => /^(?:crea|crear)\s+(?:una\s+)?propuesta(?:\s+de\s+auditor[ií]a)?(?:\s|$)/i.test(question);
const confirm = (question) => /^(confirmar propuesta|confirmo la propuesta)$/i.test(question.trim());
const isProposalCreateCommand = (question, thread) => intent(question) || confirm(question) ||
  thread.messages.at(-1)?.actionDraft?.type === "PROPOSAL_FIELDS" && /^t[ií]tulo\s*:/i.test(question.trim());

const FIELD_NAMES = { titulo: "title", objetivo: "objective", alcance: "scope",
  justificacion: "justification", area: "area", trimestre: "quarter", ano: "year",
  responsable: "responsible", tipo: "type", riesgo: "risk" };
const FIELD_LABELS = "Título, Objetivo, Alcance, Justificación, Área, Trimestre y Año";
const template = `Para preparar la propuesta, envía estos campos en un solo mensaje (uno por línea):\nTítulo: Auditoría de accesos\nObjetivo: Revisar los permisos vigentes\nAlcance: Aplicaciones del área de operaciones\nJustificación: Se requiere comprobar el control de accesos\nÁrea: Operaciones\nTrimestre: Q4\nAño: 2026\nSi lo necesitas, agrega líneas «Responsable:» con nombre exacto de un Auditor activo, «Tipo:» con Interna o Externa, y «Riesgo:» con Bajo, Medio o Alto. Si las omites, la propuesta queda sin responsable, es Interna y tiene nivel Medio.`;

const parseFields = (question) => {
  const lines = question.trim().split(/\r?\n/);
  if (intent(lines[0])) lines.shift();
  const fields = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^([^:]{1,30}):\s*(.{1,2000})$/);
    const key = match && FIELD_NAMES[normalize(match[1])];
    if (!key || Object.hasOwn(fields, key)) return { error: `Usa una línea por campo, sin repetirlos. Campos admitidos: ${FIELD_LABELS}; Responsable, Tipo y Riesgo opcionales.` };
    fields[key] = match[2].trim();
  }
  if (["title", "objective", "scope", "justification", "area", "quarter", "year"]
    .some((key) => !fields[key])) return { error: `Faltan campos. Indica ${FIELD_LABELS}.` };
  return { fields };
};

const handleProposalCreate = async (user, question, thread) => {
  if (!isProposalCreateCommand(question, thread)) return null;
  const currentUser = await userRepository.findById(user.id);
  if (currentUser?.status !== "ACTIVE" || currentUser.role !== user.role) {
    const error = new Error("Cambió tu acceso. Inicia sesión de nuevo."); error.status = 409; throw error;
  }
  if (!AUDIT_PROPOSAL_CREATE_ROLES.includes(user.role)) {
    return response("Tu rol puede consultar propuestas, pero no crearlas.");
  }
  if (confirm(question)) {
    const draft = thread.messages.at(-1)?.actionDraft;
    if (!draft || draft.type !== "PROPOSAL_CREATE") {
      return response("No hay una propuesta pendiente. Pide una vista previa nueva antes de confirmar.");
    }
    if (Date.parse(draft.expiresAt) < Date.now()) return response("La vista previa venció. Prepara la propuesta de nuevo.");
    return response("Reservando la creación de la propuesta.", "action-reservation",
      { proposalCreate: draft });
  }
  const raw = question.trim();
  if (intent(raw) && !raw.includes("\n")) {
    return response(template, "action-guidance", { actionDraft: {
      type: "PROPOSAL_FIELDS", expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } });
  }
  const pendingFields = thread.messages.at(-1)?.actionDraft;
  if (!intent(raw) && (!pendingFields || pendingFields.type !== "PROPOSAL_FIELDS" ||
      Date.parse(pendingFields.expiresAt) < Date.now())) {
    return response("El formulario conversacional venció. Escribe «Crear propuesta» para empezar de nuevo.");
  }
  const parsed = parseFields(raw);
  if (parsed.error) return response(`${parsed.error}\n${template}`, "action-guidance", { actionDraft: {
    type: "PROPOSAL_FIELDS", expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } });
  const fields = parsed.fields;
  if (!/^\d{4}$/.test(fields.year)) {
    return response("Indica un año de cuatro dígitos y envía los campos de nuevo.", "action-guidance", { actionDraft: {
      type: "PROPOSAL_FIELDS", expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } });
  }
  if (fields.title.length > 140 || fields.objective.length > 500 || fields.area.length > 100) {
    return response("El título admite hasta 140 caracteres, el objetivo hasta 500 y el área hasta 100. Envía los campos de nuevo.",
      "action-guidance", { actionDraft: { type: "PROPOSAL_FIELDS",
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } });
  }
  let responsibleId = null;
  if (fields.responsible) {
    const matches = (await activeAuditors()).filter((item) => [item.name, item.username, String(item.id)]
      .some((value) => normalize(value) === normalize(fields.responsible)));
    if (matches.length !== 1) return response("No identifiqué un único Auditor activo con ese nombre o cuenta. Revisa el responsable y envía todos los campos de nuevo.",
      "action-guidance", { actionDraft: { type: "PROPOSAL_FIELDS",
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } });
    responsibleId = matches[0].id;
  }
  const { data, error } = await parseProposal({ ...fields, responsibleId });
  if (error) return response(`${error} Envía los campos de nuevo.`, "action-guidance", { actionDraft: {
    type: "PROPOSAL_FIELDS", expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } });
  const draft = { type: "PROPOSAL_CREATE", data, operationId: randomUUID(),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  return response(`Revisa antes de guardar la propuesta:\nTítulo: ${data.title}\nObjetivo: ${data.objective}\nAlcance: ${data.scope}\nJustificación: ${data.justification}\nÁrea: ${data.area}\nPeriodo: ${data.quarter} de ${data.year}\nTipo: ${data.type}\nRiesgo: ${data.risk} (probabilidad ${data.likelihood}, impacto ${data.impact})\nResponsable: ${data.responsible}.\nEscribe «Confirmar propuesta» en los próximos cinco minutos; cualquier otra pregunta descarta esta vista previa.`,
    "action-preview", { actionDraft: draft });
};

module.exports = { isProposalCreateCommand, parseFields, handleProposalCreate };
