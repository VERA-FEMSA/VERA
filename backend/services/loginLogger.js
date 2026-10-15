const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase login logging requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return { url: url.replace(/\/+$/, ""), key };
};

const recordLogin = async ({ user, ip, method }) => {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/logins`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      user_id: user.id,
      username: user.username,
      ip_address: ip || null,
      method
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Supabase rejected login log (${response.status}): ${details}`
    );
  }
};

module.exports = { recordLogin };
