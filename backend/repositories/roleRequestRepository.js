const userRepository = require("./userRepository");

const useSupabase = process.env.VERA_USER_STORE === "supabase";
const local = [];
const storageError = (message, status = 503) => Object.assign(new Error(message), { roleRequestStorage: true, status });

const toPublic = (row) => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  requestedRole: row.requested_role,
  reason: row.reason,
  status: row.status,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at || null,
  reviewedBy: row.reviewed_by ? Number(row.reviewed_by) : null
});

const callSupabase = async (path, { method = "GET", query = {}, body } = {}) => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw storageError("No está disponible el almacén de solicitudes de rol.");
  const url = new URL(`/rest/v1/${path}`, process.env.SUPABASE_URL);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    method,
    headers: {
      apikey: key,
      ...(!key.startsWith("sb_secret_") ? { Authorization: `Bearer ${key}` } : {}),
      Accept: "application/json",
      Prefer: "return=representation",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (error.code === "23505") {
      throw storageError("Ya tienes una solicitud de rol pendiente.", 409);
    }
    throw storageError("No se pudo guardar o consultar la solicitud de rol.", path.startsWith("rpc/") ? 409 : 503);
  }
  return response.json();
};

const listMine = async (userId) => useSupabase
  ? (await callSupabase("vera_role_requests", { query: {
    select: "*", user_id: `eq.${userId}`, order: "created_at.desc", limit: "20"
  } })).map(toPublic)
  : local.filter((item) => item.user_id === userId).slice().reverse().map(toPublic);

const listPending = async () => useSupabase
  ? (await callSupabase("vera_role_requests", { query: {
    select: "*", status: "eq.PENDING", order: "created_at.asc", limit: "200"
  } })).map(toPublic)
  : local.filter((item) => item.status === "PENDING").map(toPublic);

const create = async ({ userId, requestedRole, reason }) => {
  if (useSupabase) {
    const rows = await callSupabase("vera_role_requests", {
      method: "POST", body: { user_id: userId, requested_role: requestedRole, reason }
    });
    return toPublic(rows[0]);
  }
  if (local.some((item) => item.user_id === userId && item.status === "PENDING")) {
    throw storageError("Ya tienes una solicitud de rol pendiente.", 409);
  }
  const item = { id: local.length + 1, user_id: userId, requested_role: requestedRole,
    reason, status: "PENDING", created_at: new Date().toISOString() };
  local.push(item);
  return toPublic(item);
};

const review = async ({ requestId, reviewerId, approve }) => {
  if (useSupabase) {
    return callSupabase("rpc/review_vera_role_request", {
      method: "POST", body: { p_request_id: requestId, p_reviewer_id: reviewerId, p_approve: approve }
    });
  }
  const item = local.find((entry) => entry.id === requestId && entry.status === "PENDING");
  if (!item) return null;
  if (approve) await userRepository.updateRole(item.user_id, item.requested_role);
  item.status = approve ? "APPROVED" : "REJECTED";
  item.reviewed_by = reviewerId;
  item.reviewed_at = new Date().toISOString();
  return { requestId, userId: item.user_id, role: item.requested_role, status: item.status };
};

module.exports = { listMine, listPending, create, review };
