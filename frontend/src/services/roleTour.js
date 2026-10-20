const SESSION_KEY = "vera:role-tour:admin-session";

export const startRoleTour = async (role) => {
  const response = await fetch("/api/auth/role-tour", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ role })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo abrir el recorrido.");
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  if (!token || !user) throw new Error("Inicia sesión de nuevo para recorrer los roles.");
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  window.location.assign("/dashboard");
};

export const hasRoleTourSession = () => Boolean(localStorage.getItem(SESSION_KEY));

export const endRoleTour = () => {
  let previous = null;
  try { previous = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { /* A damaged local session falls back to sign-in. */ }
  if (previous?.token && previous?.user) {
    localStorage.setItem("token", previous.token);
    localStorage.setItem("user", previous.user);
    localStorage.removeItem(SESSION_KEY);
    window.location.assign("/dashboard");
  } else {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem(SESSION_KEY);
    window.location.assign("/");
  }
};

export const clearRoleTourSession = () => localStorage.removeItem(SESSION_KEY);
