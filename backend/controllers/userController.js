const userRepository = require("../repositories/userRepository");
const { logAccessChange } = require("../services/auditLogger");
const { ROLES, ASSIGNABLE_ROLES } = require("../config/roles");
const { USER_STATUS } = require("../config/accountRules");
const roleRequests = require("../repositories/roleRequestRepository");

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
    return "Esta cuenta pertenece a un registro anterior incompleto.";
  }
  return null;
};

// GET /api/users
// El Super Admin ve todas las cuentas, incluidas las solicitudes pendientes.
// Los demás administradores no ven cuentas de Super Admin ni solicitudes pendientes.
const listUsers = async (req, res) => {
  const allUsers = await userRepository.getAll();

  const users =
    req.user.role === ROLES.SUPER_ADMIN
      ? allUsers
      : allUsers.filter(
          (u) => u.role !== ROLES.SUPER_ADMIN && u.status !== USER_STATUS.PENDING
        );

  res.json({ users });
};

// PATCH /api/users/:id/role
const updateUserRole = async (req, res) => {
  const { role } = req.body;

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ message: "El rol seleccionado no es válido." });
  }

  const target = await userRepository.findById(req.params.id);
  if (!target) {
    return res.status(404).json({ message: "Usuario no encontrado." });
  }

  const manageError = getManageError(req.user, target);
  if (manageError) {
    return res.status(403).json({ message: manageError });
  }

  const previousRole = target.role;
  const user = await userRepository.updateRole(target.id, role, target.storageVersion);

  if (previousRole !== role) {
    await logAccessChange({
      actor: req.user,
      action: "ROLE_CHANGED",
      target: user,
      details: { from: previousRole, to: role }
    });
  }

  res.json({ message: "Rol actualizado.", user });
};

// PATCH /api/users/:id/status   body: { active: true | false }
const updateUserStatus = async (req, res) => {
  const { active } = req.body;

  if (typeof active !== "boolean") {
    return res.status(400).json({ message: "El campo active debe ser true o false." });
  }

  const target = await userRepository.findById(req.params.id);
  if (!target) {
    return res.status(404).json({ message: "Usuario no encontrado." });
  }

  const manageError = getManageError(req.user, target);
  if (manageError) {
    return res.status(403).json({ message: manageError });
  }

  const user = await userRepository.setStatus(
    target.id,
    active ? USER_STATUS.ACTIVE : USER_STATUS.DISABLED,
    target.storageVersion
  );

  await logAccessChange({
    actor: req.user,
    action: active ? "USER_ENABLED" : "USER_DISABLED",
    target: user
  });

  res.json({
    message: active ? "Cuenta habilitada." : "Cuenta deshabilitada.",
    user
  });
};

module.exports = {
  listUsers,
  updateUserRole,
  updateUserStatus,
  listMyRoleRequests: async (req, res) => {
    const current = await userRepository.findById(req.user.id);
    res.json({ currentRole: current.role, requests: await roleRequests.listMine(req.user.id) });
  },
  createRoleRequest: async (req, res) => {
    const requestedRole = String(req.body.role || "");
    const reason = String(req.body.reason || "").trim();
    const current = await userRepository.findById(req.user.id);
    if (!current || current.status !== USER_STATUS.ACTIVE) return res.status(403).json({ message: "Cuenta no activa." });
    if (current.role === ROLES.SUPER_ADMIN) return res.status(400).json({ message: "Tu cuenta ya tiene el rol de administración máxima." });
    if (!ASSIGNABLE_ROLES.includes(requestedRole) || requestedRole === current.role) {
      return res.status(400).json({ message: "Selecciona un rol diferente y disponible." });
    }
    if (reason.length < 10 || reason.length > 500) {
      return res.status(400).json({ message: "Explica el motivo en 10 a 500 caracteres." });
    }
    const request = await roleRequests.create({ userId: current.id, requestedRole, reason });
    await logAccessChange({ actor: current, action: "ROLE_CHANGE_REQUESTED", target: current,
      details: { requestedRole, requestId: request.id } });
    res.status(201).json({ request });
  },
  listPendingRoleRequests: async (req, res) => {
    const requests = await roleRequests.listPending();
    const users = await userRepository.getAll();
    const byId = new Map(users.map((user) => [user.id, user]));
    res.json({ requests: requests.map((request) => ({ ...request, user: byId.get(request.userId) || null })) });
  },
  reviewRoleRequest: async (req, res) => {
    const requestId = Number(req.params.id);
    if (!Number.isSafeInteger(requestId) || requestId < 1 || typeof req.body.approve !== "boolean") {
      return res.status(400).json({ message: "Decisión inválida." });
    }
    const reviewed = await roleRequests.review({
      requestId, reviewerId: req.user.id, approve: req.body.approve
    });
    if (!reviewed) return res.status(409).json({ message: "La solicitud ya no está pendiente." });
    const target = await userRepository.findById(reviewed.userId);
    await logAccessChange({ actor: req.user,
      action: req.body.approve ? "ROLE_CHANGE_APPROVED" : "ROLE_CHANGE_REJECTED",
      target, details: { requestId, requestedRole: reviewed.role } });
    res.json({ request: reviewed });
  }
};
