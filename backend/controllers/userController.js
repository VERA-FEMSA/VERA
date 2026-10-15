const userRepository = require("../repositories/userRepository");
const { logAccessChange } = require("../services/auditLogger");
const { ROLES, ASSIGNABLE_ROLES, DEFAULT_ROLE } = require("../config/roles");
const { USER_STATUS } = require("../config/accountRules");

// Reglas de quién puede modificar a quién.
// Regresa un mensaje de error, o null si la acción está permitida.
const getManageError = (actor, target) => {
  if (actor.id === target.id) {
    return "No puedes modificar tu propia cuenta.";
  }
  if (target.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    return "Solo un Super Admin puede modificar esta cuenta.";
  }
  if (target.status === USER_STATUS.PENDING) {
    return "Esta cuenta está pendiente. Primero apruébala o recházala.";
  }
  return null;
};

// GET /api/users
// El Super Admin ve todas las cuentas, incluidas las solicitudes pendientes.
// Los demás administradores no ven cuentas de Super Admin ni solicitudes pendientes.
const listUsers = (req, res) => {
  const allUsers = userRepository.getAll();

  const users =
    req.user.role === ROLES.SUPER_ADMIN
      ? allUsers
      : allUsers.filter(
          (u) => u.role !== ROLES.SUPER_ADMIN && u.status !== USER_STATUS.PENDING
        );

  res.json({ users });
};

// PATCH /api/users/:id/role
const updateUserRole = (req, res) => {
  const { role } = req.body;

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ message: "El rol seleccionado no es válido." });
  }

  const target = userRepository.findById(req.params.id);
  if (!target) {
    return res.status(404).json({ message: "Usuario no encontrado." });
  }

  const manageError = getManageError(req.user, target);
  if (manageError) {
    return res.status(403).json({ message: manageError });
  }

  const previousRole = target.role;
  const user = userRepository.updateRole(target.id, role);

  if (previousRole !== role) {
    logAccessChange({
      actor: req.user,
      action: "ROLE_CHANGED",
      target: user,
      details: { from: previousRole, to: role }
    });
  }

  res.json({ message: "Rol actualizado.", user });
};

// PATCH /api/users/:id/status   body: { active: true | false }
const updateUserStatus = (req, res) => {
  const { active } = req.body;

  if (typeof active !== "boolean") {
    return res.status(400).json({ message: "El campo active debe ser true o false." });
  }

  const target = userRepository.findById(req.params.id);
  if (!target) {
    return res.status(404).json({ message: "Usuario no encontrado." });
  }

  const manageError = getManageError(req.user, target);
  if (manageError) {
    return res.status(403).json({ message: manageError });
  }

  const user = userRepository.setStatus(
    target.id,
    active ? USER_STATUS.ACTIVE : USER_STATUS.DISABLED
  );

  logAccessChange({
    actor: req.user,
    action: active ? "USER_ENABLED" : "USER_DISABLED",
    target: user
  });

  res.json({
    message: active ? "Cuenta habilitada." : "Cuenta deshabilitada.",
    user
  });
};

// Busca una solicitud pendiente o responde con el error correspondiente.
const findPendingOrFail = (req, res) => {
  const target = userRepository.findById(req.params.id);
  if (!target) {
    res.status(404).json({ message: "Solicitud no encontrada." });
    return null;
  }
  if (target.status !== USER_STATUS.PENDING) {
    res.status(409).json({ message: "Esta cuenta ya no está pendiente." });
    return null;
  }
  return target;
};

// POST /api/users/:id/approve   body: { role }   (solo Super Admin)
const approveRequest = (req, res) => {
  const role = req.body.role || DEFAULT_ROLE;

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ message: "El rol seleccionado no es válido." });
  }

  const target = findPendingOrFail(req, res);
  if (!target) return;

  userRepository.updateRole(target.id, role);
  const user = userRepository.setStatus(target.id, USER_STATUS.ACTIVE);

  logAccessChange({
    actor: req.user,
    action: "REQUEST_APPROVED",
    target: user,
    details: { role }
  });

  res.json({ message: "Solicitud aprobada.", user });
};

// POST /api/users/:id/reject   (solo Super Admin). La cuenta se elimina.
const rejectRequest = (req, res) => {
  const target = findPendingOrFail(req, res);
  if (!target) return;

  const user = userRepository.remove(target.id);

  logAccessChange({
    actor: req.user,
    action: "REQUEST_REJECTED",
    target: user,
    details: { email: user.email }
  });

  res.json({ message: "Solicitud rechazada.", user });
};

module.exports = {
  listUsers,
  updateUserRole,
  updateUserStatus,
  approveRequest,
  rejectRequest
};
