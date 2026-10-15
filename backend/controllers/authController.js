const jwt = require("jsonwebtoken");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const users = require("../data/users");
const userRepository = require("../repositories/userRepository");
const { logAccessChange, logActivity } = require("../services/auditLogger");
const { recordLogin } = require("../services/loginLogger");
const { DEFAULT_ROLE } = require("../config/roles");
const { getJwtSecret } = require("../config/jwtSecret");
const {
  USER_STATUS,
  INSTITUTIONAL_DOMAINS,
  isInstitutionalEmail,
  PASSWORD_RULE_MESSAGE,
  isValidPassword,
  NAME_RULE_MESSAGE,
  isValidName
} = require("../config/accountRules");


const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 5 * 60 * 1000; // 5 minutes

authenticator.options = { window: 1 }; // accept the previous/next 30s code (clock drift)

// ip -> { count, lockUntil }
const loginAttempts = new Map();

// Clean up expired entries so the Map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) {
    if (rec.lockUntil && rec.lockUntil <= now) loginAttempts.delete(ip);
  }
}, 60 * 1000).unref();

// ---------- helpers ----------

const getLock = (ip) => {
  const rec = loginAttempts.get(ip);
  return rec && rec.lockUntil > Date.now() ? rec : null;
};

const lockedResponse = (res, rec) => {
  const secondsLeft = Math.ceil((rec.lockUntil - Date.now()) / 1000);
  res.set("Retry-After", String(secondsLeft));
  return res.status(429).json({
    message: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(secondsLeft / 60)} minuto(s).`,
    retryAfter: secondsLeft
  });
};

const registerFailure = (ip) => {
  const now = Date.now();
  let rec = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
  if (rec.lockUntil && rec.lockUntil <= now) rec = { count: 0, lockUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.lockUntil = now + LOCK_TIME_MS;
  loginAttempts.set(ip, rec);
  return rec;
};

const failureResponse = (res, rec, wrongMessage) => {
  if (rec.lockUntil) {
    const secondsLeft = Math.ceil((rec.lockUntil - Date.now()) / 1000);
    res.set("Retry-After", String(secondsLeft));
    return res.status(429).json({
      message: "Demasiados intentos fallidos. Tu acceso está bloqueado por 5 minutos.",
      retryAfter: secondsLeft
    });
  }
  return res.status(401).json({ message: wrongMessage });
};

const issueSession = async (req, res, user, method = "PASSWORD") => {
  try {
    await recordLogin({ user, ip: req.ip, method });
  } catch (error) {
    console.error("[LOGIN_LOG_ERROR]", error);
    return res.status(503).json({
      message: "No se pudo registrar el inicio de sesión. Intenta de nuevo más tarde."
    });
  }


  logActivity({
    actor: user,
    action: "LOGIN_SUCCESS",
    details: { method }
  });
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    getJwtSecret(),
    { expiresIn: "2h" }
  );

  res.json({
    message: "Inicio de sesión correcto",
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
};

// ---------- step 1: username + password ----------

const login = async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;

  const lock = getLock(ip);
  if (lock) return lockedResponse(res, lock);

  // HU-01: soporta contraseñas cifradas (cuentas nuevas) y en texto plano (cuentas demo)
  const candidate = userRepository.findByLogin(username);
  const user = userRepository.checkPassword(candidate, password) ? candidate : null;


  if (!user) {
    logActivity({
      actor: { username: String(username || "").slice(0, 100) },
      action: "LOGIN_FAILED",
      details: { ip }
    });
    const rec = registerFailure(ip);
    return failureResponse(res, rec, "Usuario o contraseña incorrectos");
  }

  // HU-01: solo las cuentas activas pueden iniciar sesión
  if (user.status !== USER_STATUS.ACTIVE) {
    logActivity({
      actor: user,
      action: "LOGIN_BLOCKED",
      details: { status: user.status }
    });
  }
  if (user.status === USER_STATUS.PENDING) {
    return res.status(403).json({
      message: "Tu cuenta está pendiente de aprobación. Te avisaremos cuando un administrador la revise."
    });
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    return res.status(403).json({
      message: "Tu cuenta está deshabilitada. Contacta a un administrador."
    });
  }

  // Password OK, but 2FA still pending: do NOT reset the counter yet
  if (user.twoFactorEnabled) {
    const tempToken = jwt.sign(
      { id: user.id, purpose: "2fa" },
      getJwtSecret(),
      { expiresIn: "5m" }
    );
    return res.json({ requires2FA: true, tempToken });
  }

  loginAttempts.delete(ip);
  return issueSession(req, res, user);
};

// ---------- step 2: 6-digit code ----------

const verify2FA = async (req, res) => {
  const ip = req.ip;
  const { tempToken, code } = req.body;

  const lock = getLock(ip);
  if (lock) return lockedResponse(res, lock);

  let payload;
  try {
    payload = jwt.verify(tempToken, getJwtSecret());
  } catch {
    return res.status(401).json({ message: "Sesión expirada, inicia sesión de nuevo" });
  }

  if (payload.purpose !== "2fa") {
    return res.status(401).json({ message: "Token inválido" });
  }

  const user = users.find((u) => u.id === payload.id);

  const valid =
    user &&
    user.twoFactorEnabled &&
    authenticator.verify({
      token: String(code || ""),
      secret: user.twoFactorSecret
    });

  if (!valid) {
    if (user) logActivity({ actor: user, action: "TWO_FACTOR_FAILED", details: { ip } });
    const rec = registerFailure(ip);
    return failureResponse(res, rec, "Código incorrecto");
  }

  loginAttempts.delete(ip);
  return issueSession(req, res, user, "PASSWORD_2FA");
};

// ---------- enrollment (requires a normal logged-in session) ----------

const setup2FA = async (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const secret = authenticator.generateSecret();
  user.pendingSecret = secret;

  const otpauth = authenticator.keyuri(user.username, "VERA", secret);
  const qr = await QRCode.toDataURL(otpauth);

  // "secret" lets users type the key manually if they can't scan the QR
  res.json({ qr, secret });
};

const enable2FA = (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const ok =
    user.pendingSecret &&
    authenticator.verify({
      token: String(req.body.code || ""),
      secret: user.pendingSecret
    });

  if (!ok) return res.status(400).json({ message: "Código incorrecto" });

  user.twoFactorSecret = user.pendingSecret;
  user.twoFactorEnabled = true;
  user.pendingSecret = null;

  logActivity({ actor: user, action: "TWO_FACTOR_ENABLED" });

  res.json({ message: "2FA activado" });
};
// HU-01 (RF-01): registro propio con correo institucional.
// La cuenta queda pendiente hasta que un Super Admin la apruebe.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = async (req, res) => {
  const name = String(req.body.name || "").trim().replace(/\s+/g, " ");
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }

  if (!isValidName(name)) {
    return res.status(400).json({
      message: NAME_RULE_MESSAGE
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "El correo no tiene un formato válido." });
  }
  if (!isInstitutionalEmail(email)) {
    const domains = INSTITUTIONAL_DOMAINS.map((d) => "@" + d).join(", ");
    return res.status(400).json({
      message: `Usa tu correo institucional (${domains}).`
    });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
  }
  if (userRepository.emailExists(email)) {
    return res.status(409).json({ message: "Ya existe una cuenta o solicitud con ese correo." });
  }

  const user = await userRepository.createPending({
    name,
    email,
    password,
    role: DEFAULT_ROLE
  });

  logAccessChange({
    actor: { id: user.id, username: user.username, role: "PUBLIC" },
    action: "ACCOUNT_REQUESTED",
    target: user
  });

  res.status(201).json({
    message: "Solicitud enviada. Un administrador revisará tu cuenta."
  });
};

module.exports = { login, verify2FA, setup2FA, enable2FA, register };
