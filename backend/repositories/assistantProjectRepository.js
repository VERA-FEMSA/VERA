const { randomUUID } = require("node:crypto");

const TABLE = "vera_ai_projects";
const projects = new Map();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROJECTS = 12;

class ProjectStorageError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}

const remote = () => process.env.VERA_USER_STORE === "supabase";
const connection = () => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new ProjectStorageError("Los proyectos privados no están configurados.");
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch {
    throw new ProjectStorageError("La URL de los proyectos privados no es válida.");
  }
  if (root.protocol !== "https:") throw new ProjectStorageError("Los proyectos privados requieren HTTPS.");
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
  catch { throw new ProjectStorageError("No se pudo conectar con los proyectos privados."); }
  if (!response.ok) throw new ProjectStorageError("Los proyectos privados rechazaron la operación.");
  try { return await response.json(); } catch { throw new ProjectStorageError("Los proyectos privados devolvieron datos inválidos."); }
};

const ownerQuery = (user) => ({ owner_id: `eq.${Number(user.id)}`, owner_role: `eq.${user.role}` });
const publicRow = (row) => ({ id: row.id, name: row.name, description: row.description,
  version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });

const list = async (user) => {
  if (remote()) {
    const rows = await request("GET", { select: "id,name,description,version,created_at,updated_at",
      ...ownerQuery(user), order: "updated_at.desc", limit: String(MAX_PROJECTS) });
    if (!Array.isArray(rows)) throw new ProjectStorageError("Los proyectos privados devolvieron datos inválidos.");
    return rows.map(publicRow);
  }
  return [...projects.values()].filter((row) => row.owner_id === Number(user.id) && row.owner_role === user.role)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, MAX_PROJECTS).map(publicRow);
};

const get = async (user, id) => {
  if (!UUID.test(id)) return null;
  if (remote()) {
    const rows = await request("GET", { select: "*", ...ownerQuery(user), id: `eq.${id}`, limit: "1" });
    if (!Array.isArray(rows)) throw new ProjectStorageError("Los proyectos privados devolvieron datos inválidos.");
    return rows[0] ? publicRow(rows[0]) : null;
  }
  const row = projects.get(id);
  return row?.owner_id === Number(user.id) && row.owner_role === user.role ? publicRow(row) : null;
};

const create = async (user, name, description = "") => {
  if ((await list(user)).length >= MAX_PROJECTS) {
    throw new ProjectStorageError("Alcanzaste el límite de proyectos. Elimina uno para continuar.", 409);
  }
  const now = new Date().toISOString();
  const row = { id: randomUUID(), owner_id: Number(user.id), owner_role: user.role,
    name, description, version: 1, created_at: now, updated_at: now };
  if (remote()) {
    const rows = await request("POST", { select: "*" }, row);
    return publicRow(rows[0]);
  }
  projects.set(row.id, row);
  return publicRow(row);
};

const update = async (user, id, version, changes) => {
  const current = await get(user, id);
  if (!current) return null;
  if (current.version !== version) throw new ProjectStorageError("El proyecto cambió. Actualiza y vuelve a intentar.", 409);
  const patch = { ...changes, version: version + 1, updated_at: new Date().toISOString() };
  if (remote()) {
    const rows = await request("PATCH", { select: "*", ...ownerQuery(user), id: `eq.${id}`,
      version: `eq.${version}` }, patch);
    if (!rows.length) throw new ProjectStorageError("El proyecto cambió. Actualiza y vuelve a intentar.", 409);
    return publicRow(rows[0]);
  }
  if (projects.get(id)?.version !== version) throw new ProjectStorageError("El proyecto cambió. Actualiza y vuelve a intentar.", 409);
  const row = { ...projects.get(id), ...patch };
  projects.set(id, row);
  return publicRow(row);
};

const remove = async (user, id) => {
  if (!UUID.test(id)) return false;
  if (remote()) {
    const rows = await request("DELETE", { select: "id", ...ownerQuery(user), id: `eq.${id}` });
    return rows.length > 0;
  }
  if (!await get(user, id)) return false;
  return projects.delete(id);
};

module.exports = { ProjectStorageError, MAX_PROJECTS, list, get, create, update, remove };
