const userRepository = require("../repositories/userRepository");
const { logAccessChange } = require("../services/auditLogger");
const { ROLES, ASSIGNABLE_ROLES } = require("../config/roles");
const { USER_STATUS } = require("../config/accountRules");
const roleRequests = require("../repositories/roleRequestRepository");
const { createRoleRequestForUser, reviewRoleRequestForUser } = require("../services/roleRequestService");
const { changeUserStatus } = require("../services/userStatusService");

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
  const user = await changeUserStatus(req.user, Number(req.params.id), active);

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
    const request = await createRoleRequestForUser(req.user, requestedRole, reason);
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
    const reviewed = await reviewRoleRequestForUser(req.user, requestId, req.body.approve);
    res.json({ request: reviewed });
  }
};
