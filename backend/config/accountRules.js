// Reglas de cuentas de VERA (HU-01): estados, correo institucional y contraseñas.

const USER_STATUS = {
  PENDING: "PENDING",   // se registró y espera aprobación del Super Admin
  ACTIVE: "ACTIVE",     // puede iniciar sesión
  DISABLED: "DISABLED"  // un administrador la deshabilitó
};

// RF-01: dominios de correo institucional aceptados al registrarse.
// Configurable por entorno; vera.local conserva el demo local.
const INSTITUTIONAL_DOMAINS = (process.env.VERA_INSTITUTIONAL_DOMAINS || "vera.local")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

const isInstitutionalEmail = (email) => {
  const domain = String(email || "").toLowerCase().split("@")[1];
  return INSTITUTIONAL_DOMAINS.includes(domain);
};

// Asegurarse que el nombre incluya caracteres válidos
// Prevenir nombres como "###111", "🥺", "<DROP Table>"
const NAME_REGEX =
  /^[A-Za-zÁÉÍÓÚáéíóúÑñÜüÀ-ÿ]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜüÀ-ÿ]+)*$/;

const NAME_RULE_MESSAGE =
  "El nombre solo puede contener letras, espacios, guiones y apóstrofes.";

const isValidName = (name) => {
  if (typeof name !== "string") {
    return false;
  }

  const cleanName = name.trim();

  if (cleanName.length < 2) {
    return false;
  }

  if (cleanName.length > 50) {
    return false;
  }

  return NAME_REGEX.test(cleanName);
};

// RNF-17: mínimo 8 caracteres, con mayúsculas, minúsculas y números.
const PASSWORD_RULE_MESSAGE =
  "La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.";

const isValidPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password);

module.exports = {
  USER_STATUS,
  INSTITUTIONAL_DOMAINS,
  isInstitutionalEmail,
  isValidName,

  PASSWORD_RULE_MESSAGE,
  isValidPassword
};
