const risks = [];

const clone = (risk) => ({
  ...risk,
  createdBy: risk.createdBy ? { ...risk.createdBy } : null,
  evaluations: risk.evaluations.map((item) => ({
    ...item,
    assessedBy: item.assessedBy ? { ...item.assessedBy } : null
  }))
});

const getAll = () => risks.map(clone);
const findById = (id) => risks.find((risk) => risk.id === id) || null;
const normalize = (value) => String(value ?? "").trim().toLowerCase();

const findDuplicate = ({ title, area }, excludeId = null) => risks.find((risk) =>
  risk.id !== excludeId && normalize(risk.title) === normalize(title) && normalize(risk.area) === normalize(area)
) || null;

const nextId = () => {
  const max = risks.reduce((highest, risk) => {
    const sequence = Number(risk.id.replace("RSK-", ""));
    return Number.isNaN(sequence) ? highest : Math.max(highest, sequence);
  }, 0);
  return `RSK-${String(max + 1).padStart(3, "0")}`;
};

const create = (data) => {
  const assessedAt = new Date().toISOString();
  const risk = {
    ...data,
    id: nextId(),
    status: "OPEN",
    createdAt: assessedAt,
    updatedAt: null,
    createdBy: { ...data.createdBy },
    evaluations: [{
      version: 1,
      likelihood: data.likelihood,
      impact: data.impact,
      score: data.score,
      level: data.level,
      note: data.note,
      assessedAt,
      assessedBy: { ...data.createdBy }
    }]
  };
  delete risk.assessmentNote;
  risks.unshift(risk);
  return clone(risk);
};

const update = (id, data) => {
  const risk = findById(id);
  if (!risk) return null;
  Object.assign(risk, data, { updatedAt: new Date().toISOString() });
  return clone(risk);
};

const evaluate = (id, { likelihood, impact, score, level, note, assessedBy }) => {
  const risk = findById(id);
  if (!risk) return null;
  const evaluation = {
    version: risk.evaluations.length + 1,
    likelihood,
    impact,
    score,
    level,
    note,
    assessedAt: new Date().toISOString(),
    assessedBy: { ...assessedBy }
  };
  Object.assign(risk, { likelihood, impact, score, level, updatedAt: evaluation.assessedAt });
  risk.evaluations.push(evaluation);
  return clone(risk);
};

const memoryRepository = { getAll, findById, findDuplicate, create, update, evaluate };
module.exports = process.env.VERA_RISK_CONTROL_STORE === "supabase"
  ? require("./supabaseRiskRepository")
  : memoryRepository;
