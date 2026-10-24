const findingRepository = require("../repositories/findingRepository");
const riskRepository = require("../repositories/riskRepository");
const { ROLES } = require("../config/roles");
const { createFindingForUser } = require("../services/findingCreationService");
const { closeFindingForUser } = require("../services/findingClosureService");

const visibleTo = async (finding, user) => {
  if (user.role !== ROLES.AUDITOR) return true;
  const risk = await riskRepository.findById(finding.riskId);
  return risk?.ownerId === user.id;
};

const listFindings = async (req, res) => {
  const controlId = String(req.query.controlId ?? "").trim();
  const visible = [];
  for (const finding of await findingRepository.getAll()) {
    if (controlId && finding.controlId !== controlId) continue;
    if (await visibleTo(finding, req.user)) visible.push(finding);
  }
  res.json({ findings: visible });
};

const createFinding = async (req, res) => {
  try { return res.status(201).json({ finding: await createFindingForUser(req.user, req.body) }); }
  catch (error) {
    if ([400, 403, 404, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};

const closeFinding = async (req, res) => {
  try { return res.json({ finding: await closeFindingForUser(req.user,
    req.params.id, req.body?.note, req.body?.version) }); }
  catch (error) {
    if ([400, 403, 404, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};

module.exports = { listFindings, createFinding, closeFinding };
