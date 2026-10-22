const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { AUDIT_PROPOSAL_CREATE_ROLES, AUDIT_PROPOSAL_DELETE_ROLES, PLANNING_APPROVE_ROLES } = require("../config/roles");
const {
  listProposals,
  searchPlanningAudits,
  listActiveAudits,
  listAuditors,
  createProposal,
  updateProposal,
  approveProposal,
  startAudit,
  closeAudit,
  rejectProposal,
  deleteProposal,
  editAudit
} = require("../controllers/planningController");
const { getHistory, addComment } = require("../controllers/planningHistoryController");
const { buildAuditContext } = require("../services/auditContextService");

// Todos los usuarios con sesión pueden consultar el tablero.
router.get("/", verifyToken, listProposals);
router.get("/search", verifyToken, searchPlanningAudits);
router.get("/active", verifyToken, listActiveAudits);
router.get("/auditors", verifyToken, allowRoles(...AUDIT_PROPOSAL_CREATE_ROLES), listAuditors);
router.get("/:id/context", verifyToken, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await buildAuditContext(req.user, req.params.id));
  } catch (error) {
    if ([400, 403, 404].includes(error.status)) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});
router.get("/:id/history", verifyToken, getHistory);
const { RECORD_CREATE_ROLES } = require("../config/roles");

// Registrar comentarios: Director excluido.
router.post(
  "/:id/comments",
  verifyToken,
  allowRoles(...RECORD_CREATE_ROLES),
  addComment
);

router.post("/", verifyToken, allowRoles(...AUDIT_PROPOSAL_CREATE_ROLES), createProposal);
router.put("/:id", verifyToken, allowRoles(...AUDIT_PROPOSAL_CREATE_ROLES), updateProposal);
router.delete("/:id", verifyToken, allowRoles(...AUDIT_PROPOSAL_DELETE_ROLES), deleteProposal);
router.patch("/:id/details", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), editAudit);
router.post("/:id/approve", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), approveProposal);
router.post("/:id/start", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), startAudit);
router.post("/:id/close", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), closeAudit);
router.post("/:id/reject", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), rejectProposal);

module.exports = router;
