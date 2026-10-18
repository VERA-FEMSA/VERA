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

// Supabase exposes the first provider and linked identities, but does not
// reliably expose which linked social provider issued this particular session.
// Do not infer it from last_sign_in_at: a repeated OAuth login can reuse the
// Supabase session without advancing that identity timestamp.
const signInProvider = (user, claims) => {
  const allowed = new Set(["email", "google", "azure"]);
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  if (identities.some((entry) => !allowed.has(entry?.provider))) return null;
  if (identities.length === 1) return identities[0].provider;
  if (identities.length > 1) {
    const social = identities.filter((entry) => entry.provider !== "email");
    const methods = new Set(Array.isArray(claims?.amr) ? claims.amr.map((entry) => entry.method) : []);
    const viaOAuth = [...methods].some((method) => method === "oauth" || method?.startsWith("oauth_provider/"));
    if (identities.some((entry) => entry.provider === "email")) {
      if (methods.has("password")) return claims.aal === "aal2" ? "email" : null;
      if (!viaOAuth) return null;
    }
    if (social.length > 1) return "linked";
    if (social.length === 1 && viaOAuth) return social[0].provider;
    return null;
  }
  const first = user?.app_metadata?.provider;
  const listed = user?.app_metadata?.providers;
  return allowed.has(first) && Array.isArray(listed) && listed.length === 1 && listed[0] === first
    ? first : null;
};

module.exports = { enabled, config, normalizePassword, validateNewPassword, getUser, signInProvider };
