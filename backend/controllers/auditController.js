const { query } = require("../services/auditLogger");

// GET /api/audit?action=&actor=&from=&to=&limit=   (solo Super Admin)
const listAudit = async (req, res) => {
  const { action, actor, from, to, entityId, limit } = req.query;
  res.json({ entries: await query({ action, actor, from, to, entityId, limit }) });
};

module.exports = { listAudit };
