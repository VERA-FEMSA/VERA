const { randomUUID } = require("node:crypto");

const TABLE = "vera_ai_memory";
const entries = new Map();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MEMORIES = 8;

class MemoryStorageError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}

const remote = () => process.env.VERA_USER_STORE === "supabase";
const request = async (method, query, body) => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new MemoryStorageError("La memoria privada no está configurada.");
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch {
    throw new MemoryStorageError("La URL de la memoria privada no es válida.");
  }
  if (root.protocol !== "https:") throw new MemoryStorageError("La memoria privada requiere HTTPS.");
  const url = new URL(`/rest/v1/${TABLE}`, root);
  for (const [name, value] of Object.entries(query || {})) url.searchParams.set(name, value);
  const headers = { apikey: key, Accept: "application/json", Prefer: "return=representation" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try { response = await fetch(url, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) }); }
  catch { throw new MemoryStorageError("No se pudo conectar con la memoria privada."); }
  if (!response.ok) throw new MemoryStorageError("La memoria privada rechazó la operación.");
  try { return await response.json(); } catch { throw new MemoryStorageError("La memoria privada devolvió datos inválidos."); }
};

const ownerQuery = (user) => ({ owner_id: `eq.${Number(user.id)}`, owner_role: `eq.${user.role}` });
const publicRow = (row) => ({ id: row.id, content: row.content, enabled: row.enabled,
  version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });

const list = async (user) => {
  if (remote()) {
    const rows = await request("GET", { select: "id,content,enabled,version,created_at,updated_at",
      ...ownerQuery(user), order: "created_at.desc", limit: String(MAX_MEMORIES) });
    if (!Array.isArray(rows)) throw new MemoryStorageError("La memoria privada devolvió datos inválidos.");
    return rows.map(publicRow);
  }
  return [...entries.values()].filter((row) => row.owner_id === Number(user.id) && row.owner_role === user.role)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, MAX_MEMORIES).map(publicRow);
};

const get = async (user, id) => {
  if (!UUID.test(id)) return null;
  if (remote()) {
    const rows = await request("GET", { select: "*", ...ownerQuery(user), id: `eq.${id}`, limit: "1" });
    if (!Array.isArray(rows)) throw new MemoryStorageError("La memoria privada devolvió datos inválidos.");
    return rows[0] ? publicRow(rows[0]) : null;
  }
  const row = entries.get(id);
  return row?.owner_id === Number(user.id) && row.owner_role === user.role ? publicRow(row) : null;
};

const create = async (user, content) => {
  if ((await list(user)).length >= MAX_MEMORIES) throw new MemoryStorageError("Alcanzaste el límite de notas de memoria.", 409);
  const now = new Date().toISOString();
  const row = { id: randomUUID(), owner_id: Number(user.id), owner_role: user.role,
    content, enabled: true, version: 1, created_at: now, updated_at: now };
  if (remote()) return publicRow((await request("POST", { select: "*" }, row))[0]);
  entries.set(row.id, row);
  return publicRow(row);
};

const update = async (user, id, version, changes) => {
  const current = await get(user, id);
  if (!current) return null;
  if (current.version !== version) throw new MemoryStorageError("La nota cambió. Actualiza y vuelve a intentar.", 409);
  const patch = { ...changes, version: version + 1, updated_at: new Date().toISOString() };
  if (remote()) {
    const rows = await request("PATCH", { select: "*", ...ownerQuery(user), id: `eq.${id}`,
      version: `eq.${version}` }, patch);
    if (!rows.length) throw new MemoryStorageError("La nota cambió. Actualiza y vuelve a intentar.", 409);
    return publicRow(rows[0]);
  }
  if (entries.get(id)?.version !== version) throw new MemoryStorageError("La nota cambió. Actualiza y vuelve a intentar.", 409);
  const row = { ...entries.get(id), ...patch };
  entries.set(id, row);
  return publicRow(row);
};

const remove = async (user, id) => {
  if (!UUID.test(id)) return false;
  if (remote()) return (await request("DELETE", { select: "id", ...ownerQuery(user), id: `eq.${id}` })).length > 0;
  if (!await get(user, id)) return false;
  return entries.delete(id);
};

module.exports = { MemoryStorageError, MAX_MEMORIES, list, get, create, update, remove };
