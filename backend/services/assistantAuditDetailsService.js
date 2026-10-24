const userRepository = require("../repositories/userRepository");
const { buildAuditContext } = require("./auditContextService");
const { sourceFor } = require("./assistantContextService");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const labels = { risks: "riesgos", controls: "controles", findings: "hallazgos", evidence: "evidencias" };
const sectionFor = { riesgos: "risks", controles: "controls", hallazgos: "findings", evidencias: "evidence" };
const response = (answer, extra = {}) => ({ answer, mode: "action-guidance", citations: [],
  references: [], coverage: { partial: false }, asOf: new Date().toISOString(), usage: null, ...extra });
const parse = (question) => {
  const text = String(question || "").trim();
  const details = text.match(/^detalles de (?:la )?auditor[ií]a\s+(\S+)$/i);
  if (details) return { id: details[1], section: null };
  const more = text.match(/^m[aá]s (riesgos|controles|hallazgos|evidencias) de (?:la )?auditor[ií]a\s+(\S+)$/i);
  return more ? { id: more[2], section: sectionFor[normalize(more[1])] } : null;
};
const intent = (question) => Boolean(parse(question));
const reference = (type, item) => type === "evidence"
  ? { sourceId: `evidence:${item.id}`, type: "Evidencia", id: item.id, title: item.title,
      path: `/evidencias#evidence-${encodeURIComponent(item.id)}`, facts: [] }
  : sourceFor({ risks: "risks", controls: "controls", findings: "findings" }[type], item);
const itemText = (item) => `${item.id}: ${String(item.title || "Sin título").slice(0, 100)}`;
const sentence = (value, max = 280) => String(value || "sin dato").slice(0, max).trim().replace(/[.!?]+$/, "");

const handleAuditDetails = async (user, question, thread) => {
  const command = parse(question);
  if (!command) return null;
  const currentUser = await userRepository.findById(user.id);
  if (!currentUser || currentUser.status !== "ACTIVE" || currentUser.role !== user.role) {
    return response("Cambió tu acceso. Inicia sesión de nuevo.");
  }
  let context;
  try { context = await buildAuditContext(user, command.id); }
  catch (error) { if (error.status) return response(error.message); throw error; }
  const { audit, groups, counts } = context;
  if (command.section) {
    const previous = thread.messages.at(-1)?.auditDetailsBrowse;
    if (previous?.id !== audit.id) {
      return response(`Primero escribe «Detalles de la auditoría ${audit.id}» para iniciar el recorrido.`);
    }
    const offset = previous.offsets?.[command.section] || 0;
    const page = groups[command.section].slice(offset, offset + 5);
    if (!page.length) return response(`No hay más ${labels[command.section]} visibles en ${audit.id}.`);
    const offsets = { ...previous.offsets, [command.section]: offset + page.length };
    return response(`${labels[command.section]} de ${audit.id}: ${page.map(itemText).join("; ")}. ${offsets[command.section] < counts[command.section]
      ? `Escribe «Más ${labels[command.section]} de la auditoría ${audit.id}» para continuar.` : "Fin de esta sección."}`,
    { references: page.map((item) => reference(command.section, item)),
      coverage: { partial: Object.entries(counts).some(([key, count]) => offsets[key] < count) },
      auditDetailsBrowse: { type: "AUDIT_DETAILS", id: audit.id, offsets } });
  }
  const offsets = Object.fromEntries(Object.entries(groups).map(([key, items]) => [key, Math.min(items.length, 3)]));
  const related = Object.entries(groups).map(([key, items]) => `${labels[key]} ${counts[key]}${items.length
    ? ` (${items.slice(0, 3).map(itemText).join("; ")})` : ""}`).join(". ");
  const dates = [audit.startDate, audit.endDate].filter(Boolean).join(" → ") || "sin periodo definido";
  const progress = Number.isFinite(audit.progress) ? `${audit.progress}%` : "sin dato";
  const references = [sourceFor("audits", audit), ...Object.entries(groups).flatMap(([key, items]) =>
    items.slice(0, 3).map((item) => reference(key, item)))];
  const remaining = Object.entries(groups).filter(([key]) => offsets[key] < counts[key]);
  return response(`Auditoría ${audit.id}: ${audit.title}. Estado ${audit.status}; área ${audit.area || "sin área"}; avance ${progress}; periodo ${dates}. Objetivo: ${sentence(audit.objective)}. Alcance: ${sentence(audit.scope)}. Relaciones visibles: ${related}. ${remaining.length
    ? `Para continuar escribe «Más ${labels[remaining[0][0]]} de la auditoría ${audit.id}» (también puedes pedir las otras secciones por su nombre).` : "Se mostraron todas las relaciones visibles."}`,
  { references: references.slice(0, 15), coverage: { partial: remaining.length > 0 },
    auditDetailsBrowse: { type: "AUDIT_DETAILS", id: audit.id, offsets } });
};

module.exports = { parse, intent, handleAuditDetails };
