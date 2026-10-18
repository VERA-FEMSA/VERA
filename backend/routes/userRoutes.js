const express = require("express");
const { rateLimit } = require("express-rate-limit");

const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { ROLES, USER_VIEW_ROLES, USER_ADMIN_ROLES } = require("../config/roles");
const {
  listUsers,
  updateUserRole,
  updateUserStatus,
  listMyRoleRequests,
  createRoleRequest,
  listPendingRoleRequests,
  reviewRoleRequest
} = require("../controllers/userController");


// HU-01: consulta de usuarios para Super Admin y Director.
router.get("/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120,
  standardHeaders: "draft-8", legacyHeaders: false }), verifyToken, allowRoles(...USER_VIEW_ROLES), listUsers);

router.get("/role-requests/me", verifyToken, listMyRoleRequests);
router.post("/role-requests", verifyToken, createRoleRequest);
router.get("/role-requests/pending", verifyToken, allowRoles(ROLES.SUPER_ADMIN), listPendingRoleRequests);
router.post("/role-requests/:id/review", verifyToken, allowRoles(ROLES.SUPER_ADMIN), reviewRoleRequest);

router.patch("/:id/role", verifyToken, allowRoles(...USER_ADMIN_ROLES), updateUserRole);
router.patch("/:id/status", verifyToken, allowRoles(...USER_ADMIN_ROLES), updateUserStatus);

// HU-03
router.get(
  "/roles",
  verifyToken,
  allowRoles("SUPER_ADMIN"),
  (req, res) => {
    res.json({
      message: "Administración de roles y permisos"
    });
  }
);

module.exports = router;
