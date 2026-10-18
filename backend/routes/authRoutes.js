const express = require("express");
const { rateLimit } = require("express-rate-limit");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const { login, verify2FA, setup2FA, enable2FA, register, exchangeManaged } = require("../controllers/authController");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Demasiadas solicitudes de autenticación. Intenta más tarde.",
    code: "AUTH_RATE_LIMITED"
  }
});

router.post("/login", authLimiter, login);
router.post("/register", authLimiter, register); // HU-01
router.post("/managed/exchange", authLimiter, exchangeManaged);
router.post("/verify-2fa", authLimiter, verify2FA);
router.post("/2fa/setup", verifyToken, authLimiter, setup2FA);
router.post("/2fa/enable", verifyToken, authLimiter, enable2FA);

module.exports = router;
