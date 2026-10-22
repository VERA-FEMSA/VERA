const request = async (path = "", options = {}) => {
  const response = await fetch(`/api/actions${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo consultar el seguimiento.");
  return data;
};

export const getActions = () => request();
export const getActionSources = () => request("/sources");
export const getActionAssignees = (sourceType, sourceId) => request(
  `/assignees?sourceType=${encodeURIComponent(sourceType)}&sourceId=${encodeURIComponent(sourceId)}`
);
export const createAction = (payload) => request("", { method: "POST", body: JSON.stringify(payload) });
export const changeActionStatus = (id, payload) => request(`/${encodeURIComponent(id)}/status`, {
  method: "PATCH", body: JSON.stringify(payload)
});
export const reassignAction = (id, payload) => request(`/${encodeURIComponent(id)}/assignee`, {
  method: "PATCH", body: JSON.stringify(payload)
});
