const crypto = require("node:crypto");

const enabled = () => process.env.VERA_MANAGED_AUTH_ENABLED === "true";

const config = () => {
  const root = new URL(process.env.SUPABASE_URL || "");
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (root.protocol !== "https:" || !publicKey) {
    throw new Error("Managed Auth requiere Supabase HTTPS y su clave pública configurada.");
  }
  return { root, publicKey };
};

const request = async (path, { method = "GET", token, body } = {}) => {
  const { root, publicKey: key } = config();
  const response = await fetch(new URL(`/auth/v1/${path}`, root), {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } :
        (!key.startsWith("sb_") ? { Authorization: `Bearer ${key}` } : {})),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

const normalizePassword = (password) => String(password || "").normalize("NFC");

const validateNewPassword = async (password, email) => {
  const normalized = normalizePassword(password);
  const length = Array.from(normalized).length;
  if (length < 15 || length > 128 || Buffer.byteLength(normalized, "utf8") > 512) {
    return { valid: false, message: "Usa una contraseña de 15 a 128 caracteres." };
  }
  if ([email.toLowerCase(), "vera-digital-systems.com"].includes(normalized.toLowerCase())) {
    return { valid: false, message: "Elige una contraseña distinta de tu correo o del nombre del servicio." };
  }
  // HIBP's range protocol requires SHA-1 solely to query a five-character prefix.
  // This digest is never stored or used for authentication; Supabase Auth stores bcrypt hashes.
  // codeql[js/insufficient-password-hash]
  const hash = crypto.createHash("sha1").update(normalized, "utf8").digest("hex").toUpperCase();
  let response;
  try {
    response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "VERA-password-screening" },
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    return { valid: false, unavailable: true };
  }
  if (!response.ok) return { valid: false, unavailable: true };
  const suffix = hash.slice(5);
  const compromised = (await response.text()).split(/\r?\n/).some((line) => {
    const [candidate, count] = line.split(":");
    return candidate === suffix && Number(count) > 0;
  });
  return compromised
    ? { valid: false, message: "Esta contraseña aparece en filtraciones conocidas. Elige otra." }
    : { valid: true, password: normalized };
};

const getUser = async (token) => request("user", { token });

module.exports = { enabled, config, normalizePassword, validateNewPassword, getUser };
