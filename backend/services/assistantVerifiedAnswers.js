const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim();

const countQuestions = [
  { key: "highRisks", subject: "riesgos altos" },
  { key: "ineffectiveControls", subject: "controles por revisar" },
  { key: "openFindings", subject: "hallazgos abiertos" },
  { key: "urgentPending", subject: "pendientes prioritarios" },
  { key: "activeAudits", subject: "auditorias activas" }
];

const allowedSuffix = "(?:| hay| tengo| hay en mi alcance| tengo en mi alcance| hay en el portafolio| veo)";

function getVerifiedAnswer({ question, context, brief, sourceCatalog }) {
  const normalized = normalize(question);
  for (const { key, subject } of countQuestions) {
    const pattern = new RegExp(`^cuant[oa]s ${subject}${allowedSuffix}$`);
    if (!pattern.test(normalized)) continue;
    const metric = brief.find((item) => item.key === key);
    if (!metric || !Number.isSafeInteger(metric.count) || metric.count < 0) return null;
    return { answer: `${metric.label} en tu alcance: ${metric.count}.`, sourceIds: [], metric, mode: "computed" };
  }

  const focus = context.focus;
  if (focus?.type !== "risk" || !sourceCatalog.some((item) => item.sourceId === `risks:${focus.id}`)) return null;
  const sourceIds = [`risks:${focus.id}`];
  if (/^cual es el nivel de este riesgo$/.test(normalized) && focus.level) {
    return { answer: `El nivel de este riesgo es ${focus.level}.`, sourceIds, mode: "computed" };
  }
  if (/^cual es (?:el puntaje|la puntuacion) de este riesgo$/.test(normalized) && Number.isFinite(focus.score)) {
    return { answer: `El puntaje de este riesgo es ${focus.score}.`, sourceIds, mode: "computed" };
  }
  if (/^cual es el nivel y (?:el puntaje|la puntuacion) de este riesgo$/.test(normalized) &&
      focus.level && Number.isFinite(focus.score)) {
    return { answer: `El nivel de este riesgo es ${focus.level} y su puntaje es ${focus.score}.`, sourceIds, mode: "computed" };
  }
  return null;
}

module.exports = { getVerifiedAnswer };
