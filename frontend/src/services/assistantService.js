const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const getAssistantStatus = async () => {
  const response = await fetch("/api/assistant/status", { headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo consultar el estado del asistente.");
  return data;
};

const conversationRequest = async (path = "", options = {}) => {
  const response = await fetch(`/api/assistant/conversations${path}`, {
    ...options, headers: { ...headers(), ...(options.body ? { "Content-Type": "application/json" } : {}) },
    cache: "no-store"
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo consultar el historial privado.");
  return data;
};

export const listAssistantConversations = async () => (await conversationRequest()).conversations;
export const getAssistantConversation = async (id) => (await conversationRequest(`/${encodeURIComponent(id)}`)).conversation;
export const createAssistantConversation = async (focus) => (await conversationRequest("", {
  method: "POST", body: JSON.stringify({ focus })
})).conversation;
export const renameAssistantConversation = async (id, title, version) =>
  (await conversationRequest(`/${encodeURIComponent(id)}`, {
    method: "PATCH", body: JSON.stringify({ title, version })
  })).conversation;
export const deleteAssistantConversation = async (id) => conversationRequest(`/${encodeURIComponent(id)}`, {
  method: "DELETE"
});
export const askAssistantConversation = async (id, question, withEvidence = false) =>
  conversationRequest(`/${encodeURIComponent(id)}/ask`, {
    method: "POST", body: JSON.stringify({ question, withEvidence })
  });

export const getAssistantBrief = async () => {
  const response = await fetch("/api/assistant/brief", { headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar las prioridades.");
  return data;
};

export const getAssistantQuality = async () => {
  const response = await fetch("/api/assistant/quality", { headers: headers(), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo consultar la calidad del asistente.");
  return data;
};

export const getAssistantInsights = async () => {
  const response = await fetch("/api/assistant/insights", { headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar las prioridades.");
  return data;
};

export const getProposalDraft = async (riskId) => {
  const response = await fetch("/api/assistant/draft-proposal", {
    method: "POST", headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ riskId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo preparar el borrador.");
  return data;
};

export const submitAssistantFeedback = async (feedbackToken, rating) => {
  const response = await fetch("/api/assistant/feedback", {
    method: "POST", headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ feedbackToken, rating })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo registrar tu valoración.");
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

export const searchAssistantEvidence = async (question, focus = null) => {
  const response = await fetch("/api/assistant/search-evidence", {
    method: "POST", headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ question, focus })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudieron consultar las evidencias.");
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
