const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const getAssistantStatus = async () => {
  const response = await fetch("/api/assistant/status", { headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo consultar el estado del asistente.");
  return data;
};

export const askAssistant = async (question) => {
  const response = await fetch("/api/assistant/ask", {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo obtener una respuesta.");
  return data;
};
