const planningRepository = require("../repositories/planningRepository");
const findingRepository = require("../repositories/findingRepository");
const riskRepository = require("../repositories/riskRepository");
const { getDashboardForUser } = require("../services/dashboardService");

const parsePeriod = (query) => {
  const period = query.period || "all";
  if (!(["all", "year", "semester", "quarter"].includes(period))) return null;
  if (period === "all") return { period };
  const year = Number(query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || Array.isArray(query.year)) return null;
  if (period === "semester") {
    const semester = Number(query.semester);
    return [1, 2].includes(semester) && !Array.isArray(query.semester) ? { period, year, semester } : null;
  }
  if (period === "quarter") {
    return ["Q1", "Q2", "Q3", "Q4"].includes(query.quarter) ? { period, year, quarter: query.quarter } : null;
  }
  return { period, year };
};

const getDashboard = async (req, res) => {
  const selectedPeriod = parsePeriod(req.query);
  if (!selectedPeriod) return res.status(400).json({ message: "Periodo inválido. Selecciona año, semestre o trimestre válido." });
  const [proposals, findings] = await Promise.all([planningRepository.getAll(), findingRepository.getAll()]);
  let visibleFindings = findings;
  if (req.user.role === "AUDITOR") {
    const ownedRiskIds = new Set((await riskRepository.getAll())
      .filter((risk) => risk.ownerId === req.user.id).map((risk) => risk.id));
    visibleFindings = findings.filter((finding) => ownedRiskIds.has(finding.riskId));
  }
  res.json(getDashboardForUser(req.user, proposals, visibleFindings, selectedPeriod));
};

module.exports = { getDashboard };
