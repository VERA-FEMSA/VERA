// Bitácora de auditoría en memoria (igual que el resto de los datos del demo).
// Se conservan los últimos MAX_ENTRIES eventos.
const MAX_ENTRIES = 1000;

const entries = [];
let nextId = 1;

const record = ({ actor, action, target = null, details = {} }) => {
  const entry = {
    id: nextId++,
    date: new Date().toISOString(),
    action,
    actor: {
      id: actor.id ?? null,
      username: actor.username ?? null,
      role: actor.role ?? null
    },
    target: target ? { id: target.id ?? null, username: target.username ?? null } : null,
    details
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();

  console.log("[AUDITORÍA DE ACCESOS]", JSON.stringify(entry));
  return entry;
};

// Cambios sobre cuentas (HU-01): el actor modifica a otro usuario.
const logAccessChange = ({ actor, action, target, details = {} }) =>
  record({ actor, action, target, details });

// Actividad del propio usuario: inicios de sesión, 2FA, etc.
const logActivity = ({ actor, action, details = {} }) =>
  record({ actor, action, details });

// Más recientes primero. Filtros opcionales: action, actor (texto), from/to (ISO), entityId, limit.
const query = ({ action, actor, from, to, entityId, limit = 200 } = {}) => {
  const text = actor ? String(actor).trim().toLowerCase() : "";
  const fromTime = from ? Date.parse(from) : NaN;
  const toTime = to ? Date.parse(to) : NaN;

  const result = entries.filter((e) => {
    const details = e.details || {};
    if (action && e.action !== action) return false;
    if (entityId && details.proposalId !== entityId && details.auditId !== entityId) return false;
    if (text && !(e.actor.username || "").toLowerCase().includes(text)) return false;
    const time = Date.parse(e.date);
    if (!Number.isNaN(fromTime) && time < fromTime) return false;
    if (!Number.isNaN(toTime) && time > toTime) return false;
    return true;
  });

  const max = Math.min(Math.max(Number(limit) || 200, 1), MAX_ENTRIES);
  return result.slice(-max).reverse();
};

module.exports = { logAccessChange, logActivity, query };
