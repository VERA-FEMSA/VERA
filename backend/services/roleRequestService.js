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

const pendingRoleReviewsForUser = async (user) => {
  const current = await userRepository.findById(user.id);
  if (!current || current.status !== USER_STATUS.ACTIVE || current.role !== user.role ||
      current.role !== ROLES.SUPER_ADMIN) {
    throw failure("Solo una cuenta Super Admin activa puede revisar solicitudes de rol.", 403);
  }
  const [requests, users] = await Promise.all([roleRequests.listPending(), userRepository.getAll()]);
  const byId = new Map(users.map((item) => [item.id, item]));
  return requests.map((request) => ({ request, target: byId.get(request.userId) || null }));
};

const prepareRoleReview = async (user, requestId, expectedTargetRole = null) => {
  if (!Number.isSafeInteger(requestId) || requestId < 1) throw failure("Solicitud de rol inválida.");
  const pending = await pendingRoleReviewsForUser(user);
  const item = pending.find(({ request }) => request.id === requestId);
  if (!item) throw failure("La solicitud ya no está pendiente. Actualiza la lista.", 409);
  if (!item.target || item.target.status !== USER_STATUS.ACTIVE || item.target.role === ROLES.SUPER_ADMIN) {
    throw failure("La cuenta solicitante ya no puede cambiar de rol.", 409);
  }
  if (expectedTargetRole && item.target.role !== expectedTargetRole) {
    throw failure("El rol de la cuenta cambió desde la vista previa. Actualiza la lista.", 409);
  }
  return item;
};

const reviewRoleRequestForUser = async (user, requestId, approve, expectedTargetRole = null) => {
  if (typeof approve !== "boolean") throw failure("Decisión inválida.");
  const { request } = await prepareRoleReview(user, requestId, expectedTargetRole);
  const reviewed = await roleRequests.review({ requestId, reviewerId: user.id, approve });
  if (!reviewed) throw failure("La solicitud ya no está pendiente.", 409);
  const target = await userRepository.findById(reviewed.userId);
  await logAccessChange({ actor: user, action: approve ? "ROLE_CHANGE_APPROVED" : "ROLE_CHANGE_REJECTED",
    target, details: { requestId, requestedRole: request.requestedRole } });
  return reviewed;
};

module.exports = { prepareRoleRequest, createRoleRequestForUser, pendingRoleReviewsForUser,
  prepareRoleReview, reviewRoleRequestForUser };
