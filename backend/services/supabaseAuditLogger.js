const { randomUUID } = require("node:crypto");

class AuditStorageError extends Error {
  constructor(message) {
    super(message);
    this.status = 503;
    this.auditStorage = true;
  }
}

const config = () => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new AuditStorageError("Falta configurar Supabase para la bitácora.");
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch {
    throw new AuditStorageError("La URL de Supabase no es válida.");
  }
  if (root.protocol !== "https:") throw new AuditStorageError("La URL de Supabase debe usar HTTPS.");
  return { root, key };
};

const request = async (method, filters = [], body) => {
  const { root, key } = config();
  const url = new URL("/rest/v1/vera_audit_events", root);
  for (const [name, value] of filters) url.searchParams.append(name, value);
  const headers = { apikey: key, Accept: "application/json", Prefer: "return=minimal" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(url, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new AuditStorageError("No se pudo conectar con la bitácora.");
  }
  if (!response.ok) throw new AuditStorageError("La bitácora rechazó la operación.");
  return method === "GET" ? response.json() : [];
};

const normalizeActor = (actor) => ({
  id: actor.id ?? null,
  username: actor.username ?? null,
  role: actor.role ?? null
});

const record = async ({ actor, action, target = null, details = {} }) => {
  const entry = {
    id: randomUUID(), date: new Date().toISOString(), action,
    actor: normalizeActor(actor),
    target: target ? { id: target.id ?? null, username: target.username ?? null } : null,
    details
  };
  const entityId = details.proposalId || details.auditId || details.riskId ||
    details.controlId || details.evidenceId || null;
  try {
    await request("POST", [], {
      id: entry.id, occurred_at: entry.date, source: "APPLICATION", action,
      actor: entry.actor, actor_username: entry.actor.username,
      target: entry.target, details, entity_id: entityId
    });
  } catch (error) {
    // Database triggers record committed changes even if this richer event cannot be written.
    console.error("[AUDIT_EVENT_WRITE_FAILED]", error.message);
    return null;
  }
  return entry;
};

const logAccessChange = ({ actor, action, target, details = {} }) =>
  record({ actor, action, target, details });
const logActivity = ({ actor, action, details = {} }) =>
  record({ actor, action, details });

const query = async ({ action, actor, from, to, entityId, limit = 200 } = {}) => {
  const max = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const filters = [
    ["select", "id,occurred_at,action,actor,target,details"],
    ["order", "occurred_at.desc"],
    ["limit", String(max)]
  ];
  if (action) filters.push(["action", `eq.${action}`]);
  if (entityId) filters.push(["entity_id", `eq.${entityId}`]);
  const username = String(actor || "").trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "");
  if (username) filters.push(["actor_username", `ilike.*${username}*`]);
  if (from && Number.isFinite(Date.parse(from))) {
    filters.push(["occurred_at", `gte.${new Date(from).toISOString()}`]);
  }
  if (to && Number.isFinite(Date.parse(to))) {
    filters.push(["occurred_at", `lte.${new Date(to).toISOString()}`]);
  }
  const rows = await request("GET", filters);
  return rows.map((row) => ({
    id: row.id, date: row.occurred_at, action: row.action,
    actor: normalizeActor(row.actor || {}), target: row.target || null,
    details: row.details || {}
  }));
};

module.exports = { logAccessChange, logActivity, query, AuditStorageError };
