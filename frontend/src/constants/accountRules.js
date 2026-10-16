// Debe coincidir con backend/config/accountRules.js

export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED"
};

// RNF-17: reglas de contraseña, para mostrarlas mientras la persona escribe.
export const PASSWORD_CHECKS = [
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
