const { randomUUID } = require("node:crypto");

const TABLE = "vera_ai_conversations";
const conversations = new Map();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONVERSATIONS = 30;

class ConversationStorageError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}

const remote = () => process.env.VERA_USER_STORE === "supabase";
const connection = () => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new ConversationStorageError("El historial privado no está configurado.");
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch {
    throw new ConversationStorageError("La URL del historial privado no es válida.");
  }
  if (root.protocol !== "https:") throw new ConversationStorageError("El historial privado requiere HTTPS.");
  return { root, key };
};

const request = async (method, query, body) => {
  const { root, key } = connection();
  const url = new URL(`/rest/v1/${TABLE}`, root);
  for (const [name, value] of Object.entries(query || {})) url.searchParams.set(name, value);
  const headers = { apikey: key, Accept: "application/json", Prefer: "return=representation" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try { response = await fetch(url, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) }); }
  catch { throw new ConversationStorageError("No se pudo conectar con el historial privado."); }
  if (!response.ok) throw new ConversationStorageError("El historial privado rechazó la operación.");
  try { return await response.json(); } catch { throw new ConversationStorageError("El historial privado devolvió datos inválidos."); }
};

const ownerQuery = (user) => ({ owner_id: `eq.${Number(user.id)}`, owner_role: `eq.${user.role}` });
const publicRow = (row, includeMessages = false) => ({ id: row.id, title: row.title,
  focus: row.focus_type ? { type: row.focus_type, id: row.focus_id } : null,
  projectId: row.project_id || null,
  createdAt: row.created_at, updatedAt: row.updated_at,
  version: row.version, ...(includeMessages ? { messages: row.messages, scopeHash: row.scope_hash } : {}) });

const list = async (user) => {
  if (remote()) {
    const rows = await request("GET", { select: "id,title,focus_type,focus_id,project_id,created_at,updated_at,version",
      ...ownerQuery(user), order: "updated_at.desc", limit: String(MAX_CONVERSATIONS) });
    if (!Array.isArray(rows)) throw new ConversationStorageError("El historial privado devolvió datos inválidos.");
    return rows.map((row) => publicRow(row));
  }
  return [...conversations.values()].filter((row) => row.owner_id === Number(user.id) && row.owner_role === user.role)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, MAX_CONVERSATIONS)
    .map((row) => publicRow(row));
};

const get = async (user, id) => {
  if (!UUID.test(id)) return null;
  if (remote()) {
    const rows = await request("GET", { select: "*", ...ownerQuery(user), id: `eq.${id}`, limit: "1" });
    if (!Array.isArray(rows)) throw new ConversationStorageError("El historial privado devolvió datos inválidos.");
    return rows[0] ? publicRow(rows[0], true) : null;
  }
  const row = conversations.get(id);
  return row?.owner_id === Number(user.id) && row.owner_role === user.role
    ? publicRow(row, true) : null;
};

const create = async (user, focus = null, scopeHash, projectId = null) => {
  if ((await list(user)).length >= MAX_CONVERSATIONS) {
    throw new ConversationStorageError("Alcanzaste el límite de conversaciones. Elimina una para continuar.", 409);
  }
  const now = new Date().toISOString();
  const row = { id: randomUUID(), owner_id: Number(user.id), owner_role: user.role,
    title: "Nueva conversación", focus_type: focus?.type || null, focus_id: focus?.id || null,
    project_id: projectId,
    scope_hash: scopeHash, messages: [], version: 1, created_at: now, updated_at: now };
  if (remote()) {
    const rows = await request("POST", { select: "*" }, row);
    return publicRow(rows[0], true);
  }
  conversations.set(row.id, row);
  return publicRow(row, true);
};

const update = async (user, id, version, changes) => {
  const current = await get(user, id);
  if (!current) return null;
  if (current.version !== version) throw new ConversationStorageError("La conversación cambió. Actualiza y vuelve a intentar.", 409);
  const now = new Date().toISOString();
  const patch = { ...changes, version: version + 1, updated_at: now };
  if (remote()) {
    const rows = await request("PATCH", { select: "*", ...ownerQuery(user), id: `eq.${id}`,
      version: `eq.${version}` }, patch);
    if (!rows.length) throw new ConversationStorageError("La conversación cambió. Actualiza y vuelve a intentar.", 409);
    return publicRow(rows[0], true);
  }
  if (conversations.get(id)?.version !== version) {
    throw new ConversationStorageError("La conversación cambió. Actualiza y vuelve a intentar.", 409);
  }
  const row = { ...conversations.get(id), ...patch };
  conversations.set(id, row);
  return publicRow(row, true);
};

const remove = async (user, id) => {
  if (!UUID.test(id)) return false;
  if (remote()) {
    const rows = await request("DELETE", { select: "id", ...ownerQuery(user), id: `eq.${id}` });
    return rows.length > 0;
  }
  if (!await get(user, id)) return false;
  return conversations.delete(id);
};

const unlinkProject = async (user, projectId) => {
  if (remote()) return; // ON DELETE SET NULL handles the persistent adapter.
  for (const [id, row] of conversations) {
    if (row.owner_id === Number(user.id) && row.owner_role === user.role && row.project_id === projectId) {
      conversations.set(id, { ...row, project_id: null, version: row.version + 1,
        updated_at: new Date().toISOString() });
    }
  }
};

module.exports = { ConversationStorageError, MAX_CONVERSATIONS, list, get, create, update, remove, unlinkProject };
