const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const userRepository = require("../repositories/userRepository");
const { logAccessChange, logActivity } = require("../services/auditLogger");
const { recordLogin } = require("../services/loginLogger");
const { DEFAULT_ROLE } = require("../config/roles");
const { getJwtSecret } = require("../config/jwtSecret");
const { verifyTotpCode } = require("../services/totp");
const managedAuth = require("../services/managedAuth");
const { PRIVACY_NOTICE_VERSION } = require("../config/privacyNotice");
const {
  USER_STATUS,
  NAME_RULE_MESSAGE,
  isValidName
} = require("../config/accountRules");


const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 5 * 60 * 1000; // 5 minutes

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


  await logActivity({
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
  const candidate = await userRepository.findByLogin(username);
  // The frontend tries legacy login first, then Supabase Auth for managed accounts.
  // A managed account cannot have a valid legacy password; do not count this
  // handoff as a failed password attempt or lock out legitimate sign-ins.
  if (managedAuth.enabled() && candidate?.authUserId) {
    return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
  }
  const user = await userRepository.checkPassword(candidate, password) ? candidate : null;


  if (!user) {
    await logActivity({
      actor: { username: String(username || "").slice(0, 100) },
      action: "LOGIN_FAILED",
      details: { ip }
    });
    const rec = registerFailure(ip);
    return failureResponse(res, rec, "Usuario o contraseña incorrectos");
  }

  // HU-01: solo las cuentas activas pueden iniciar sesión
  if (user.status !== USER_STATUS.ACTIVE) {
    await logActivity({
      actor: user,
      action: "LOGIN_BLOCKED",
      details: { status: user.status }
    });
  }
  if (user.status === USER_STATUS.PENDING) {
    return res.status(403).json({
      message: "Esta cuenta pertenece a un registro anterior incompleto. Contacta a soporte."
    });
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    return res.status(403).json({
      message: "Tu cuenta está deshabilitada. Contacta a un administrador."
    });
  }

  if (user.mfaRequired && !user.twoFactorEnabled) {
    return res.json({
      requiresMfaSetup: true,
      setupToken: jwt.sign({ id: user.id, purpose: "mfa-enroll" }, getJwtSecret(), { expiresIn: "10m" })
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

  const user = await userRepository.findById(payload.id);

  const valid =
    user &&
    user.twoFactorEnabled &&
    verifyTotpCode(user.twoFactorSecret, code);

  if (!valid) {
    if (user) await logActivity({ actor: user, action: "TWO_FACTOR_FAILED", details: { ip } });
    const rec = registerFailure(ip);
    return failureResponse(res, rec, "Código incorrecto");
  }

  loginAttempts.delete(ip);
  return issueSession(req, res, user, "PASSWORD_2FA");
};

// ---------- enrollment (requires a normal logged-in session) ----------

const setup2FA = async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const { generateSecret, generateURI } = require("otplib");
  const secret = generateSecret();
  await userRepository.setPendingSecret(user.id, secret);

  const otpauth = generateURI({ issuer: "VERA", label: user.username, secret });
  const qr = await QRCode.toDataURL(otpauth);

  // "secret" lets users type the key manually if they can't scan the QR
  res.json({ qr, secret });
};

const enable2FA = async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const ok =
    user.pendingSecret &&
    verifyTotpCode(user.pendingSecret, req.body.code);

  if (!ok) return res.status(400).json({ message: "Código incorrecto" });

  const enabledUser = await userRepository.enableTwoFactor(user.id, user.pendingSecret);
  if (!enabledUser) return res.status(409).json({ message: "La configuración 2FA cambió. Vuelve a iniciar el proceso." });

  await logActivity({ actor: user, action: "TWO_FACTOR_ENABLED" });

  if (req.user.mfaEnrollment) return issueSession(req, res, enabledUser, "PASSWORD_2FA");
  res.json({ message: "2FA activado" });
};
// HU-01 (RF-01): alta inmediata con contraseña y rol inicial mínimo.
// Validación lineal: evita retroceso costoso con correos controlados por el cliente.
const isValidEmailFormat = (email) => {
  if (!email || email.length > 254 || /\s/.test(email)) return false;
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return false;
  const dot = email.indexOf(".", at + 1);
  return dot > at + 1 && dot < email.length - 1;
};

const register = async (req, res) => {
  if (process.env.VERA_DIRECT_REGISTRATION_ENABLED !== "true") {
    return res.status(404).json({ message: "El registro con contraseña no está disponible. Usa Microsoft o Google." });
  }
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

  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ message: "El correo no tiene un formato válido." });
  }
  if (req.body.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION || req.body.privacyAccepted !== true) {
    return res.status(400).json({ message: "Lee y acepta el aviso de privacidad vigente antes de crear tu cuenta." });
  }
  const policy = await managedAuth.validateNewPassword(password, email);
  if (policy.unavailable) return res.status(503).json({ message: "No se pudo verificar la seguridad de la contraseña. Intenta más tarde." });
  if (!policy.valid) return res.status(400).json({ message: policy.message });
  if (await userRepository.emailExists(email)) {
    return res.status(409).json({ message: "Ya existe una cuenta con ese correo." });
  }
  const user = await userRepository.createActivePassword({
    name, email, password: policy.password, role: DEFAULT_ROLE,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION
  });
  await logAccessChange({
    actor: { id: user.id, username: user.username, role: "PUBLIC" },
    action: "ACCOUNT_REGISTERED",
    target: user,
    details: { method: "PASSWORD", emailVerified: false }
  });
  return res.status(201).json({ message: "Cuenta creada. Inicia sesión y configura la verificación con tu aplicación de autenticación." });
};

const exchangeManaged = async (req, res) => {
  if (!managedAuth.enabled()) return res.status(404).json({ message: "Método de acceso no disponible." });
  const accessToken = req.body?.accessToken;
  if (typeof accessToken !== "string" || accessToken.length > 5000) {
    return res.status(400).json({ message: "Sesión de identidad inválida." });
  }
  let result;
  try { result = await managedAuth.getUser(accessToken); } catch {
    return res.status(503).json({ message: "No se pudo verificar la identidad. Intenta más tarde." });
  }
  if (!result.ok) return res.status(401).json({ message: "Sesión de identidad inválida o expirada." });
  const identity = result.data;
  const email = String(identity.email || "").trim().toLowerCase();
  const provider = identity.app_metadata?.provider;
  const claims = jwt.decode(accessToken);
  const expectedIssuer = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
  if (!identity.id || !isValidEmailFormat(email) || !identity.email_confirmed_at ||
      !["email", "google", "azure"].includes(provider) ||
      !claims || claims.sub !== identity.id || claims.iss !== expectedIssuer) {
    return res.status(401).json({ message: "No se pudo verificar la identidad y el correo." });
  }
  if ((provider === "google" && process.env.VERA_GOOGLE_AUTH_ENABLED !== "true") ||
      (provider === "azure" && process.env.VERA_AZURE_AUTH_ENABLED !== "true")) {
    return res.status(403).json({ message: "Este proveedor aún no está disponible en VERA." });
  }
  let user = await userRepository.findByAuthUserId(identity.id);
  if (!user) {
    if (provider === "email") {
      return res.status(403).json({ message: "Completa el registro desde VERA antes de iniciar sesión." });
    }
    if (await userRepository.emailExists(email)) {
      return res.status(409).json({ message: "Ese correo ya tiene una cuenta VERA. Solicita vinculación a un administrador." });
    }
    if (req.body.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION || req.body.privacyAccepted !== true) {
      return res.status(403).json({ message: "Para solicitar acceso, abre Crear cuenta y acepta el aviso de privacidad." });
    }
    const name = String(identity.user_metadata?.full_name || identity.user_metadata?.name || email)
      .trim().slice(0, 100);
    const created = await userRepository.createActiveExternal({
      name, email, authUserId: identity.id, authProvider: provider, role: DEFAULT_ROLE,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION
    });
    await logAccessChange({
      actor: { id: created.id, username: created.username, role: "PUBLIC" },
      action: "ACCOUNT_REGISTERED",
      target: created,
      details: { method: provider.toUpperCase() }
    });
    return issueSession(req, res, created, `OAUTH_${provider.toUpperCase()}`);
  }
  // Supabase can link Google and Microsoft to the same verified auth identity.
  // Keep the stable auth_user_id and email as the binding; the initial provider
  // is historical metadata and must not block the second linked provider.
  if (user.email !== email) {
    return res.status(403).json({ message: "La identidad necesita revisión de un administrador." });
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    return res.status(403).json({ message: user.status === USER_STATUS.PENDING
      ? "Esta cuenta pertenece a un registro anterior incompleto." : "Tu cuenta está deshabilitada." });
  }
  if (user.authProvider === "email" && claims.aal !== "aal2") {
    return res.status(428).json({ code: "MFA_REQUIRED", message: "Configura o completa la verificación con tu aplicación de autenticación." });
  }
  return issueSession(req, res, user, provider === "email" ? "MANAGED_PASSWORD_TOTP" : `OAUTH_${provider.toUpperCase()}`);
};

module.exports = { login, verify2FA, setup2FA, enable2FA, register, exchangeManaged };
