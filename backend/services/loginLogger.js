const getSupabaseConfig = () => {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !key) throw new Error("El registro de accesos requiere SUPABASE_URL y una clave secreta del backend.");

  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("SUPABASE_URL no es válida."); }
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL debe usar HTTPS.");

  return { url, key };
};

const recordLogin = async ({ user, ip, method }) => {
  const { url, key } = getSupabaseConfig();
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "return=minimal"
  };
  // Las claves sb_secret_* no son JWT. Solo las claves legacy usan Bearer.
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(new URL("/rest/v1/logins", url), {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: user.id,
      username: user.username,
      ip_address: ip || null,
      method
    })
  });

  if (!response.ok) {
    throw new Error(`Supabase rechazó el registro de acceso (${response.status}).`);
  }
};

module.exports = { recordLogin };
