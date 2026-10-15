const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { listEvidence, createEvidence } = require("../controllers/evidenceController");

router.get("/", verifyToken, listEvidence);
router.post("/", verifyToken, createEvidence);

module.exports = router;
