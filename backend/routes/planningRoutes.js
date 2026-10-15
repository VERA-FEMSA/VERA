const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { PLANNING_CREATE_ROLES, PLANNING_APPROVE_ROLES } = require("../config/roles");
const {
  listProposals,
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

// Todos los usuarios con sesión pueden consultar el tablero.
router.get("/", verifyToken, listProposals);
router.get("/active", verifyToken, listActiveAudits);
router.get("/auditors", verifyToken, allowRoles(...PLANNING_CREATE_ROLES), listAuditors);
router.get("/:id/history", verifyToken, getHistory);
router.post("/:id/comments", verifyToken, addComment);

router.post("/", verifyToken, allowRoles(...PLANNING_CREATE_ROLES), createProposal);
router.put("/:id", verifyToken, allowRoles(...PLANNING_CREATE_ROLES), updateProposal);
router.delete("/:id", verifyToken, allowRoles(...PLANNING_CREATE_ROLES), deleteProposal);
router.patch("/:id/details", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), editAudit);
router.post("/:id/approve", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), approveProposal);
router.post("/:id/start", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), startAudit);
router.post("/:id/close", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), closeAudit);
router.post("/:id/reject", verifyToken, allowRoles(...PLANNING_APPROVE_ROLES), rejectProposal);

module.exports = router;
