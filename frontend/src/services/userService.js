const API_URL = "/api/users";

const request = async (path, options = {}) => {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No se pudo completar la acción.");
  }

  return data;
};

export const getUsers = async () => {
  const data = await request("");
  return data.users;
};

export const getMyRoleRequests = async () => request("/role-requests/me");

export const createRoleRequest = async (role, reason) => (await request("/role-requests", {
  method: "POST", body: JSON.stringify({ role, reason })
})).request;

export const getPendingRoleRequests = async () => (await request("/role-requests/pending")).requests;

export const reviewRoleRequest = async (id, approve) => (await request(`/role-requests/${id}/review`, {
  method: "POST", body: JSON.stringify({ approve })
})).request;


export const updateUserRole = async (id, role) => {
  const data = await request(`/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
  return data.user;
};

export const updateUserStatus = async (id, active) => {
  const data = await request(`/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ active })
  });
  return data.user;
};
