const bcrypt = require("bcryptjs");
const { USER_STATUS } = require("../config/accountRules");

const TABLE = "vera_users";
const PAGE_SIZE = 1000;
const COLUMNS = "id,username,email,name,password_hash,role,status,requested_at,two_factor_enabled,two_factor_secret,pending_secret,version";

class UserStorageError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
    this.userStorage = true;
  }
}

const config = () => {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) {
    throw new UserStorageError("Falta configurar la conexión de Supabase para cuentas.");
  }
  let root;
  try { root = new URL(process.env.SUPABASE_URL); } catch {
    throw new UserStorageError("La URL de Supabase no es válida.");
  }
  if (root.protocol !== "https:") throw new UserStorageError("La URL de Supabase debe usar HTTPS.");
  return { root, key };
};

const request = async (method, query = {}, body, range) => {
  const { root, key } = config();
  const url = new URL(`/rest/v1/${TABLE}`, root);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const headers = { apikey: key, Accept: "application/json", Prefer: "return=representation" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (range) headers.Range = range;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new UserStorageError("No se pudo conectar con la base de datos de cuentas.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (error.code === "23505") throw new UserStorageError("Ya existe una cuenta con ese correo o usuario.", 409);
    throw new UserStorageError("La base de datos de cuentas rechazó la operación.");
  }
  return response.status === 204 ? [] : response.json();
};

const unpack = (row) => row ? ({
  id: Number(row.id),
  username: row.username,
  email: row.email,
  name: row.name,
  password: row.password_hash,
  role: row.role,
  status: row.status,
  requestedAt: row.requested_at,
  twoFactorEnabled: row.two_factor_enabled,
  twoFactorSecret: row.two_factor_secret,
  pendingSecret: row.pending_secret,
  storageVersion: Number(row.version)
}) : null;

const toPublic = (user) => ({
  id: user.id, username: user.username, name: user.name, email: user.email,
  role: user.role, status: user.status, requestedAt: user.requestedAt || null,
  twoFactorEnabled: Boolean(user.twoFactorEnabled)
});

const getAll = async () => {
  const users = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const rows = await request("GET", { select: COLUMNS, order: "id.asc" }, undefined, `${offset}-${offset + PAGE_SIZE - 1}`);
    users.push(...rows.map((row) => toPublic(unpack(row))));
    if (rows.length < PAGE_SIZE) break;
  }
  return users;
};

const findById = async (id) => {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) return null;
  const rows = await request("GET", { select: COLUMNS, id: `eq.${Number(id)}`, limit: "1" });
  return unpack(rows[0]);
};

const findByLogin = async (identifier) => {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) return null;
  const column = value.includes("@") ? "email" : "username";
  const rows = await request("GET", { select: COLUMNS, [column]: `eq.${value}`, limit: "1" });
  return unpack(rows[0]);
};

const emailExists = async (email) => {
  const value = String(email || "").trim().toLowerCase();
  const rows = await request("GET", { select: "id", email: `eq.${value}`, limit: "1" });
  return rows.length > 0;
};

const createPending = async ({ name, email, password, role }) => {
  const normalizedEmail = email.toLowerCase();
  const rows = await request("POST", { select: COLUMNS }, {
    username: normalizedEmail,
    email: normalizedEmail,
    name,
    password_hash: await bcrypt.hash(password, 10),
    role,
    status: USER_STATUS.PENDING,
    requested_at: new Date().toISOString()
  });
  return toPublic(unpack(rows[0]));
};

const createBootstrapAdmin = async ({ name, email, password }) => {
  if ((await getAll()).some((user) => user.role === "SUPER_ADMIN")) {
    throw new UserStorageError("Ya existe un Super Admin; no se puede repetir la inicialización.", 409);
  }
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await request("POST", { select: COLUMNS }, {
    username: normalizedEmail,
    email: normalizedEmail,
    name,
    password_hash: await bcrypt.hash(password, 12),
    role: "SUPER_ADMIN",
    status: USER_STATUS.ACTIVE
  });
  return toPublic(unpack(rows[0]));
};

const mutate = async (id, changes, allowedStatuses, expectedPendingSecret, expectedVersion) => {
  const current = await findById(id);
  if (!current) return null;
  if (expectedVersion !== undefined && current.storageVersion !== expectedVersion) {
    throw new UserStorageError("La cuenta cambió mientras la editabas. Actualiza y vuelve a intentar.", 409);
  }
  if (allowedStatuses && !allowedStatuses.includes(current.status)) {
    throw new UserStorageError("El estado de la cuenta cambió. Actualiza y vuelve a intentar.", 409);
  }
  if (expectedPendingSecret && current.pendingSecret !== expectedPendingSecret) {
    throw new UserStorageError("La configuración 2FA cambió. Vuelve a iniciar el proceso.", 409);
  }
  const rows = await request("PATCH", {
    select: COLUMNS, id: `eq.${current.id}`, version: `eq.${current.storageVersion}`,
    ...(expectedPendingSecret ? { pending_secret: `eq.${expectedPendingSecret}` } : {})
  }, { ...changes, version: current.storageVersion + 1, updated_at: new Date().toISOString() });
  if (!rows.length) throw new UserStorageError("La cuenta cambió mientras la editabas. Actualiza y vuelve a intentar.", 409);
  return unpack(rows[0]);
};

const updateRole = async (id, role, expectedVersion) => {
  const user = await mutate(id, { role }, null, null, expectedVersion);
  return user && toPublic(user);
};
const setStatus = async (id, status, expectedVersion) => {
  const user = await mutate(id, { status }, null, null, expectedVersion);
  return user && toPublic(user);
};
const approvePending = async (id, role, expectedVersion) => {
  const user = await mutate(id, { role, status: USER_STATUS.ACTIVE }, [USER_STATUS.PENDING], null, expectedVersion);
  return user && toPublic(user);
};
const remove = async (id) => {
  const current = await findById(id);
  if (!current) return null;
  const rows = await request("DELETE", {
    select: COLUMNS, id: `eq.${current.id}`, version: `eq.${current.storageVersion}`
  });
  if (!rows.length) throw new UserStorageError("La cuenta cambió mientras la eliminabas. Actualiza y vuelve a intentar.", 409);
  return toPublic(unpack(rows[0]));
};

const removePending = async (id, expectedVersion) => {
  const current = await findById(id);
  if (!current || current.status !== USER_STATUS.PENDING) return null;
  if (expectedVersion !== undefined && current.storageVersion !== expectedVersion) {
    throw new UserStorageError("La cuenta cambió mientras la editabas. Actualiza y vuelve a intentar.", 409);
  }
  const rows = await request("DELETE", {
    select: COLUMNS, id: `eq.${current.id}`, version: `eq.${current.storageVersion}`,
    status: `eq.${USER_STATUS.PENDING}`
  });
  if (!rows.length) throw new UserStorageError("La cuenta cambió mientras la editabas. Actualiza y vuelve a intentar.", 409);
  return toPublic(unpack(rows[0]));
};

const setPendingSecret = (id, secret) => mutate(id, { pending_secret: secret });
const enableTwoFactor = (id, expectedSecret) => {
  if (!expectedSecret) throw new UserStorageError("No existe una configuración 2FA pendiente.", 409);
  return mutate(id, { two_factor_secret: expectedSecret, two_factor_enabled: true, pending_secret: null }, null, expectedSecret);
};

const checkPassword = (user, plainPassword) =>
  Boolean(user && typeof plainPassword === "string" &&
    user.password.startsWith("$2") && bcrypt.compareSync(plainPassword, user.password));

module.exports = {
  getAll, findById, findByLogin, emailExists, createPending, createBootstrapAdmin, updateRole, setStatus,
  approvePending, remove, removePending, setPendingSecret, enableTwoFactor, checkPassword, toPublic,
  UserStorageError
};
