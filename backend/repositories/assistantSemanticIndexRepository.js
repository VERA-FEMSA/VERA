const { MODEL, DIMENSIONS } = require("../services/azureEmbeddingService");

const TABLE = "vera_ai_project_vectors";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const memory = new Map();

class SemanticIndexError extends Error {
  constructor() { super("El índice semántico privado no está disponible."); this.status = 503; }
}

const remote = () => process.env.VERA_USER_STORE === "supabase";
const connection = () => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new SemanticIndexError();
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch { throw new SemanticIndexError(); }
  if (root.protocol !== "https:") throw new SemanticIndexError();
  return { root, key };
};

const request = async (path, body) => {
  const { root, key } = connection();
  const headers = { apikey: key, Accept: "application/json", "Content-Type": "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (path === `/rest/v1/${TABLE}`) headers.Prefer = "resolution=merge-duplicates,return=minimal";
  let response;
  try { response = await fetch(new URL(path, root), { method: "POST", headers,
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) }); }
  catch { throw new SemanticIndexError(); }
  if (!response.ok) throw new SemanticIndexError();
  if (path === `/rest/v1/${TABLE}`) return null;
  try { return await response.json(); } catch { throw new SemanticIndexError(); }
};

const validateScope = (user, projectId) => {
  if (!Number.isInteger(Number(user?.id)) || Number(user.id) < 1 ||
      typeof user.role !== "string" || !UUID.test(projectId)) throw new SemanticIndexError();
};

const status = async (user, projectId) => {
  validateScope(user, projectId);
  if (remote()) {
    const rows = await request("/rest/v1/rpc/vera_ai_project_vector_status", {
      p_owner_id: Number(user.id), p_owner_role: user.role, p_project_id: projectId, p_model: MODEL
    });
    if (!Array.isArray(rows)) throw new SemanticIndexError();
    return new Map(rows.map((row) => [row.attachment_id, Number(row.indexed_chunks)]));
  }
  const counts = new Map();
  for (const [id, value] of memory) {
    if (value.ownerId === Number(user.id) && value.ownerRole === user.role &&
        value.projectId === projectId) counts.set(id, value.vectors.length);
  }
  return counts;
};

const replace = async (user, projectId, attachmentId, vectors) => {
  validateScope(user, projectId);
  if (!UUID.test(attachmentId) || !Array.isArray(vectors) || !vectors.length || vectors.length > 50 ||
      vectors.some((vector) => !Array.isArray(vector) || vector.length !== DIMENSIONS ||
        vector.some((value) => !Number.isFinite(value)))) throw new SemanticIndexError();
  if (remote()) {
    await request(`/rest/v1/${TABLE}`, vectors.map((embedding, chunkIndex) => ({
      attachment_id: attachmentId, chunk_index: chunkIndex, model: MODEL,
      embedding: `[${embedding.join(",")}]`
    })));
    return;
  }
  memory.set(attachmentId, { ownerId: Number(user.id), ownerRole: user.role, projectId,
    vectors: vectors.map((row) => [...row]) });
};

const similarity = (a, b) => {
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < DIMENSIONS; i += 1) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const search = async (user, projectId, vector) => {
  validateScope(user, projectId);
  if (!Array.isArray(vector) || vector.length !== DIMENSIONS ||
      vector.some((value) => !Number.isFinite(value))) throw new SemanticIndexError();
  if (remote()) {
    const rows = await request("/rest/v1/rpc/vera_ai_search_project_vectors", {
      p_owner_id: Number(user.id), p_owner_role: user.role, p_project_id: projectId,
      p_model: MODEL, p_embedding: `[${vector.join(",")}]`, p_limit: 5
    });
    if (!Array.isArray(rows)) throw new SemanticIndexError();
    return rows.map((row) => ({ attachmentId: row.attachment_id,
      chunkIndex: row.chunk_index, score: row.score }));
  }
  return [...memory.entries()].filter(([, value]) => value.ownerId === Number(user.id) &&
    value.ownerRole === user.role && value.projectId === projectId)
    .flatMap(([attachmentId, value]) => value.vectors.map((embedding, chunkIndex) => ({
      attachmentId, chunkIndex, score: similarity(embedding, vector)
    }))).sort((a, b) => b.score - a.score || a.attachmentId.localeCompare(b.attachmentId) ||
      a.chunkIndex - b.chunkIndex).slice(0, 5);
};

const forget = (attachmentId) => { if (!remote()) memory.delete(attachmentId); };

module.exports = { SemanticIndexError, status, replace, search, forget };
