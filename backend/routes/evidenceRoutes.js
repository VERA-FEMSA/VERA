const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { rateLimit } = require("express-rate-limit");
const { listEvidence, createEvidence, uploadEvidence, downloadEvidence, askEvidence } = require("../controllers/evidenceController");

router.get("/", verifyToken, listEvidence);
router.post("/", verifyToken, createEvidence);
router.post("/upload", verifyToken, express.raw({ type: () => true, limit: "3mb" }), uploadEvidence);
router.get("/:id/download", verifyToken, downloadEvidence);
router.post("/:id/ask", verifyToken, rateLimit({ windowMs: 15 * 60 * 1000, limit: 10,
  keyGenerator: (req) => String(req.user.id), standardHeaders: "draft-8", legacyHeaders: false }), askEvidence);

module.exports = router;
