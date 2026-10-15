const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { ROLES } = require("../config/roles");
const { listAudit } = require("../controllers/auditController");

// Registro de actividad de todos los usuarios (solo Super Admin)
router.get("/", verifyToken, allowRoles(ROLES.SUPER_ADMIN), listAudit);

module.exports = router;
