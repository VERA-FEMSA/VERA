const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const getAssistantStatus = async () => {
  const response = await fetch("/api/assistant/status", { headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo consultar el estado del asistente.");
  return data;
};

export const getAssistantBrief = async () => {
  const response = await fetch("/api/assistant/brief", { headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar las prioridades.");
  return data;
};

export const askAssistant = async (question, { history = [], focus = null } = {}) => {
  const response = await fetch("/api/assistant/ask", {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ question, history, focus })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo obtener una respuesta.");
  return data;
};

export const getAuditDossier = async (auditId) => {
  const response = await fetch(`/api/assistant/dossier/${encodeURIComponent(auditId)}`, {
    method: "POST", headers: headers()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo preparar el briefing.");
  return data;
};
