const userRepository = require("../repositories/userRepository");
const { logAccessChange } = require("./auditLogger");
const { ROLES } = require("../config/roles");
const { USER_STATUS } = require("../config/accountRules");

const fail = (message, status = 403) => { const error = new Error(message); error.status = status; throw error; };

const prepareUserStatus = async (actor, id, expected = {}) => {
  const current = await userRepository.findById(actor.id);
  if (!current || current.status !== USER_STATUS.ACTIVE || current.role !== actor.role ||
      actor.role !== ROLES.SUPER_ADMIN) fail("Solo un Super Admin activo puede cambiar cuentas.");
  if (!Number.isSafeInteger(id) || id < 1) fail("ID de cuenta inválido.", 400);
  const target = await userRepository.findById(id);
  if (!target) fail("Usuario no encontrado.", 404);
  if (Number(actor.id) === Number(target.id)) fail("No puedes modificar tu propia cuenta.");
  if (target.status === USER_STATUS.PENDING) fail("Esta cuenta pertenece a un registro anterior incompleto.");
  if (![USER_STATUS.ACTIVE, USER_STATUS.DISABLED].includes(target.status)) fail("Estado de cuenta no admitido.", 409);
  if (expected.status !== undefined && target.status !== expected.status) fail("El estado de la cuenta cambió. Consulta el directorio de nuevo.", 409);
  if (expected.version !== undefined && target.storageVersion !== expected.version) fail("La cuenta cambió. Consulta el directorio de nuevo.", 409);
  return target;
};

const changeUserStatus = async (actor, id, active, expected = {}) => {
  if (typeof active !== "boolean") fail("El campo active debe ser true o false.", 400);
  const target = await prepareUserStatus(actor, id, expected);
  const next = active ? USER_STATUS.ACTIVE : USER_STATUS.DISABLED;
  if (target.status === next) fail(`La cuenta ya está ${active ? "habilitada" : "deshabilitada"}.`, 409);
  const user = await userRepository.setStatus(target.id, next, target.storageVersion);
  await logAccessChange({ actor, action: active ? "USER_ENABLED" : "USER_DISABLED", target: user,
    details: expected.reason ? { reason: expected.reason } : {} });
  return user;
};

module.exports = { prepareUserStatus, changeUserStatus };
