// Debe coincidir con backend/config/accountRules.js

export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED"
};

// New accounts: NIST SP 800-63B-4. The server also checks breached passwords.
export const PASSWORD_CHECKS = import.meta.env.VITE_VERA_MANAGED_AUTH_ENABLED === "true"
  ? [{ label: "De 15 a 128 caracteres", test: (p) => {
      const length = Array.from(p.normalize("NFC")).length;
      return length >= 15 && length <= 128;
    } }]
  : [
      { label: "Al menos 8 caracteres", test: (p) => p.length >= 8 },
      { label: "Una mayúscula", test: (p) => /[A-Z]/.test(p) },
      { label: "Una minúscula", test: (p) => /[a-z]/.test(p) },
      { label: "Un número", test: (p) => /[0-9]/.test(p) }
    ];

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
