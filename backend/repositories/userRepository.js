const bcrypt = require("bcryptjs");
const users = require("../data/users");
const { USER_STATUS } = require("../config/accountRules");

// Datos que sí se pueden enviar al frontend (nunca contraseñas ni secretos 2FA).
const toPublic = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  requestedAt: user.requestedAt || null,
  twoFactorEnabled: Boolean(user.twoFactorEnabled)
});

const getAll = () => users.map(toPublic);

const findById = (id) => users.find((u) => u.id === Number(id)) || null;

// RF-03: se puede iniciar sesión con correo o con nombre de usuario.
const findByLogin = (identifier) => {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) return null;
  return users.find((u) => u.email === value || u.username === value) || null;
};

const emailExists = (email) =>
  users.some((u) => u.email === String(email || "").toLowerCase());

// Registro propio: la cuenta nace pendiente de aprobación.
const createPending = async ({ name, email, password, role }) => {
  const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
  const normalizedEmail = email.toLowerCase();

  const user = {
    id: nextId,
    username: normalizedEmail,
    email: normalizedEmail,
    password: await bcrypt.hash(password, 10),
    name,
    role,
    status: USER_STATUS.PENDING,
    requestedAt: new Date().toISOString(),
    twoFactorEnabled: false,
    twoFactorSecret: null,
    pendingSecret: null
  };

  users.push(user);
  return toPublic(user);
};

const updateRole = (id, role) => {
  const user = findById(id);
  if (!user) return null;
  user.role = role;
  return toPublic(user);
};

const setStatus = (id, status) => {
  const user = findById(id);
  if (!user) return null;
  user.status = status;
  return toPublic(user);
};

const remove = (id) => {
  const index = users.findIndex((u) => u.id === Number(id));
  if (index === -1) return null;
  const [removed] = users.splice(index, 1);
  return toPublic(removed);
};

// Las cuentas demo tienen contraseña en texto plano; las nuevas, cifrada con bcrypt.
const checkPassword = (user, plainPassword) => {
  if (!user || typeof plainPassword !== "string") return false;
  if (user.password.startsWith("$2")) {
    return bcrypt.compareSync(plainPassword, user.password);
  }
  return user.password === plainPassword;
};

module.exports = {
  toPublic,
  getAll,
  findById,
  findByLogin,
  emailExists,
  createPending,
  updateRole,
  setStatus,
  remove,
  checkPassword
};
