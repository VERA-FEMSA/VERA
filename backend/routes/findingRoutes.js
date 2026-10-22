const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { RECORD_CREATE_ROLES } = require("../config/roles");
const {
  listFindings,
  createFinding,
  closeFinding
} = require("../controllers/findingController");

const router = express.Router();

router.get("/", verifyToken, listFindings);

router.post(
  "/",
  verifyToken,
  allowRoles(...RECORD_CREATE_ROLES),
  createFinding
);

router.patch("/:id/close", verifyToken, allowRoles(...RECORD_CREATE_ROLES), closeFinding);

module.exports = router;
