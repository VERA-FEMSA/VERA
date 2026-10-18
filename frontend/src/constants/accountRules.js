// Debe coincidir con backend/config/accountRules.js

export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED"
};

// New accounts: NIST SP 800-63B-4. The server also checks breached passwords.
export const PASSWORD_CHECKS = [{ label: "De 15 a 128 caracteres", test: (p) => {
  const length = Array.from(p.normalize("NFC")).length;
  return length >= 15 && length <= 128;
} }];

// Validar nombres validos
export const NAME_REGEX =
  /^[A-Za-zÁÉÍÓÚáéíóúÑñÜüÀ-ÿ]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜüÀ-ÿ]+)*$/;

export const validateName = (name) => {
  const cleanName = String(name || "").trim();

  if (!cleanName) {
    return "El nombre es obligatorio.";
  }

  if (cleanName.length < 2) {
    return "El nombre debe tener al menos 2 caracteres.";
  }

  if (cleanName.length > 50) {
    return "El nombre no puede superar los 50 caracteres.";
  }

  if (!NAME_REGEX.test(cleanName)) {
    return "El nombre solo puede contener letras, espacios, guiones y apóstrofes.";
  }

  return "";
};
