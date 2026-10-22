const { randomUUID } = require("node:crypto");

const TABLE = "vera_ai_attachments";
const attachments = new Map();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_CONVERSATION = 2;
const MAX_PER_USER = 20;

class AttachmentStorageError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}

const remote = () => process.env.VERA_USER_STORE === "supabase";
const request = async (method, query, body) => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new AttachmentStorageError("Los adjuntos privados no están configurados.");
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch {
    throw new AttachmentStorageError("La URL de los adjuntos privados no es válida.");
  }
  if (root.protocol !== "https:") throw new AttachmentStorageError("Los adjuntos privados requieren HTTPS.");
  const url = new URL(`/rest/v1/${TABLE}`, root);
  for (const [name, value] of Object.entries(query || {})) url.searchParams.set(name, value);
  const headers = { apikey: key, Accept: "application/json", Prefer: "return=representation" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try { response = await fetch(url, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) }); }
  catch { throw new AttachmentStorageError("No se pudo conectar con los adjuntos privados."); }
  if (!response.ok) throw new AttachmentStorageError("Los adjuntos privados rechazaron la operación.");
  try { return await response.json(); } catch { throw new AttachmentStorageError("Los adjuntos privados devolvieron datos inválidos."); }
};

const ownerQuery = (user) => ({ owner_id: `eq.${Number(user.id)}`, owner_role: `eq.${user.role}` });
const publicRow = (row) => ({ id: row.id, conversationId: row.conversation_id, name: row.name,
  mime: row.file.mime, size: row.file.size, status: row.status, truncated: row.truncated,
  chunks: row.chunks.length, createdAt: row.created_at });

const list = async (user, conversationId) => {
  if (!UUID.test(conversationId)) return [];
  if (remote()) {
    const rows = await request("GET", { select: "id,conversation_id,name,file,status,truncated,chunks,created_at",
      ...ownerQuery(user), conversation_id: `eq.${conversationId}`, order: "created_at.desc",
      limit: "100" });
    if (!Array.isArray(rows)) throw new AttachmentStorageError("Los adjuntos privados devolvieron datos inválidos.");
    return rows.map(publicRow);
  }
  return [...attachments.values()].filter((row) => row.owner_id === Number(user.id) &&
    row.owner_role === user.role && row.conversation_id === conversationId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).map(publicRow);
};

const countForUser = async (user) => {
  if (remote()) {
    const rows = await request("GET", { select: "id", ...ownerQuery(user), limit: String(MAX_PER_USER) });
    if (!Array.isArray(rows)) throw new AttachmentStorageError("Los adjuntos privados devolvieron datos inválidos.");
    return rows.length;
  }
  return [...attachments.values()].filter((row) => row.owner_id === Number(user.id) &&
    row.owner_role === user.role).length;
};

const get = async (user, conversationId, id) => {
  if (!UUID.test(conversationId) || !UUID.test(id)) return null;
  if (remote()) {
    const rows = await request("GET", { select: "*", ...ownerQuery(user), conversation_id: `eq.${conversationId}`,
      id: `eq.${id}`, limit: "1" });
    if (!Array.isArray(rows)) throw new AttachmentStorageError("Los adjuntos privados devolvieron datos inválidos.");
    return rows[0] || null;
  }
  const row = attachments.get(id);
  return row?.owner_id === Number(user.id) && row.owner_role === user.role &&
    row.conversation_id === conversationId ? row : null;
};

const create = async (user, conversationId, data) => {
  if ((await list(user, conversationId)).length >= MAX_PER_CONVERSATION ||
      await countForUser(user) >= MAX_PER_USER) {
    throw new AttachmentStorageError("Alcanzaste el límite de archivos del chat.", 409);
  }
  const row = { id: randomUUID(), conversation_id: conversationId, owner_id: Number(user.id),
    owner_role: user.role, name: data.name, file: data.file, chunks: data.chunks,
    status: data.status, truncated: data.truncated, created_at: new Date().toISOString() };
  if (remote()) return publicRow((await request("POST", { select: "*" }, row))[0]);
  attachments.set(row.id, row);
  return publicRow(row);
};

const remove = async (user, conversationId, id) => {
  if (!UUID.test(id) || !UUID.test(conversationId)) return false;
  if (remote()) {
    const rows = await request("DELETE", { select: "id", ...ownerQuery(user),
      conversation_id: `eq.${conversationId}`, id: `eq.${id}` });
    return rows.length > 0;
  }
  if (!await get(user, conversationId, id)) return false;
  return attachments.delete(id);
};

module.exports = { AttachmentStorageError, MAX_PER_CONVERSATION, MAX_PER_USER,
  list, countForUser, get, create, remove };
