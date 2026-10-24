const memory = new Map();
const TABLE = "vera_evidence_index_coverage";
const VALID_ID = /^EVD-[A-Za-z0-9-]{1,80}$/;
const STATUSES = new Set(["ready", "no-text", "pending", "unsupported"]);

class EvidenceCoverageError extends Error {
  constructor(message) { super(message); this.status = 503; }
}

const configured = () => process.env.VERA_EVIDENCE_COMMENT_STORE === "supabase";
const config = () => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new EvidenceCoverageError("El estado privado de lectura no está configurado.");
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch {
    throw new EvidenceCoverageError("La URL del estado privado no es válida.");
  }
  if (root.protocol !== "https:") throw new EvidenceCoverageError("El estado privado requiere HTTPS.");
  return { root, key };
};

const request = async (method, ids, coverage) => {
  const { root, key } = config();
  const url = new URL(`/rest/v1/${TABLE}`, root);
  const headers = { apikey: key, Accept: "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (method === "GET") {
    url.searchParams.set("select", "evidence_id,status,indexed_chunks,truncated,updated_at");
    url.searchParams.set("evidence_id", `in.(${ids.join(",")})`);
    url.searchParams.set("limit", String(ids.length));
  } else {
    url.searchParams.set("on_conflict", "evidence_id");
    headers["Content-Type"] = "application/json";
    headers.Prefer = "resolution=merge-duplicates,return=minimal";
  }
  let response;
  try {
    response = await fetch(url, { method, headers,
      body: coverage ? JSON.stringify(coverage) : undefined,
      signal: AbortSignal.timeout(10_000) });
  } catch { throw new EvidenceCoverageError("No se pudo conectar con el estado privado de lectura."); }
  if (!response.ok) throw new EvidenceCoverageError("El estado privado de lectura rechazó la operación.");
  return method === "GET" ? response.json() : null;
};

const validateId = (id) => {
  if (typeof id !== "string" || !VALID_ID.test(id)) throw new EvidenceCoverageError("Identificador de evidencia no válido.");
};

const getMany = async (ids) => {
  if (!Array.isArray(ids)) throw new EvidenceCoverageError("La lista de evidencias no es válida.");
  ids.forEach(validateId);
  const unique = [...new Set(ids)];
  if (!configured()) return new Map(unique.filter((id) => memory.has(id)).map((id) => [id, { ...memory.get(id) }]));
  const rows = [];
  for (let start = 0; start < unique.length; start += 50) {
    rows.push(...await request("GET", unique.slice(start, start + 50)));
  }
  return new Map(rows.map((row) => [row.evidence_id, {
    status: row.status, chunks: row.indexed_chunks, truncated: row.truncated,
    updatedAt: row.updated_at
  }]));
};

const set = async (id, value) => {
  validateId(id);
  if (!value || !STATUSES.has(value.status) || !Number.isInteger(value.chunks) ||
      value.chunks < 0 || value.chunks > 60 || typeof value.truncated !== "boolean") {
    throw new EvidenceCoverageError("El estado de lectura no es válido.");
  }
  const updatedAt = new Date().toISOString();
  const coverage = { status: value.status, chunks: value.chunks,
    truncated: value.truncated, updatedAt };
  if (configured()) await request("POST", null, { evidence_id: id, status: value.status,
    indexed_chunks: value.chunks, truncated: value.truncated, updated_at: updatedAt });
  else memory.set(id, coverage);
  return coverage;
};

const forget = (id) => memory.delete(id);
module.exports = { EvidenceCoverageError, getMany, set, forget };
