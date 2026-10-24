const userRepository = require("../repositories/userRepository");
const roleRequests = require("../repositories/roleRequestRepository");
const { logAccessChange } = require("./auditLogger");
const { ROLES, ASSIGNABLE_ROLES } = require("../config/roles");
const { USER_STATUS } = require("../config/accountRules");

const failure = (message, status = 400) => Object.assign(new Error(message), { roleRequestStorage: true, status });

const prepareRoleRequest = async (user, requestedRole, reason, expectedRole) => {
  const current = await userRepository.findById(user.id);
  if (!current || current.status !== USER_STATUS.ACTIVE) throw failure("Cuenta no activa.", 403);
  if (current.role !== user.role || (expectedRole && current.role !== expectedRole)) {
    throw failure("Cambió tu acceso. Inicia sesión de nuevo.", 409);
  }
  if (current.role === ROLES.SUPER_ADMIN) {
    throw failure("Tu cuenta ya tiene el rol de administración máxima.");
  }
  if (!ASSIGNABLE_ROLES.includes(requestedRole) || requestedRole === current.role) {
    throw failure("Selecciona un rol diferente y disponible.");
  }
  if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 500) {
    throw failure("Explica el motivo en 10 a 500 caracteres.");
  }
  if ((await roleRequests.listMine(current.id)).some((item) => item.status === "PENDING")) {
    throw failure("Ya tienes una solicitud de rol pendiente.", 409);
  }
  return { current, requestedRole, reason: reason.trim() };
};

const createRoleRequestForUser = async (user, requestedRole, reason, expectedRole) => {
  const prepared = await prepareRoleRequest(user, requestedRole, reason, expectedRole);
  const request = await roleRequests.create({ userId: prepared.current.id, requestedRole, reason: prepared.reason });
  await logAccessChange({ actor: prepared.current, action: "ROLE_CHANGE_REQUESTED", target: prepared.current,
    details: { requestedRole, requestId: request.id } });
  return request;
};

module.exports = { prepareRoleRequest, createRoleRequestForUser };
