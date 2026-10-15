const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { ROLES, USER_ADMIN_ROLES } = require("../config/roles");
const {
  listUsers,
  updateUserRole,
  updateUserStatus,
  approveRequest,
  rejectRequest
} = require("../controllers/userController");


// HU-01: creación y gestión de usuarios
router.get("/", verifyToken, allowRoles(...USER_ADMIN_ROLES), listUsers);

// HU-01: solicitudes de registro (solo Super Admin)
router.post("/:id/approve", verifyToken, allowRoles(ROLES.SUPER_ADMIN), approveRequest);
router.post("/:id/reject", verifyToken, allowRoles(ROLES.SUPER_ADMIN), rejectRequest);
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