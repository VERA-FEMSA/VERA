const userRepository = require("../repositories/userRepository");
const { ROLES, USER_VIEW_ROLES } = require("../config/roles");

const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const roleNames = { auditor: ROLES.AUDITOR, jefatura: ROLES.JEFATURA,
  gerente: ROLES.GERENTE, director: ROLES.DIRECTOR, "super admin": ROLES.SUPER_ADMIN };
const response = (answer, extra = {}) => ({ answer, mode: "action-guidance", citations: [],
  references: [], coverage: { partial: false }, asOf: new Date().toISOString(), usage: null, ...extra });
const parse = (question) => {
  const command = normalize(question);
  if (command === "usuarios del sistema") return { kind: "list", role: null, next: false };
  if (command === "siguientes usuarios") return { kind: "list", role: null, next: true };
  const role = command.match(/^usuarios con rol (auditor|jefatura|gerente|director|super admin)$/);
  if (role) return { kind: "list", role: roleNames[role[1]], next: false };
  const email = String(question || "").trim().match(/^busca usuario\s+([^\s@]+@[^\s@]+\.[^\s@]+)$/i);
  return email ? { kind: "search", email: email[1].toLowerCase() } : null;
};
const intent = (question) => Boolean(parse(question));
const visibleUsers = async (user) => {
  const current = await userRepository.findById(user.id);
  if (!current || current.status !== "ACTIVE" || current.role !== user.role) {
    const error = new Error("Cambió tu acceso. Inicia sesión de nuevo."); error.status = 409; throw error;
  }
  if (!USER_VIEW_ROLES.includes(user.role)) return null;
  const users = await userRepository.getAll();
  return user.role === ROLES.SUPER_ADMIN ? users
    : users.filter((item) => item.role !== ROLES.SUPER_ADMIN && item.status !== "PENDING");
};
const lineFor = (item) => `#${item.id}: ${String(item.name || item.username).slice(0, 80)} · ${item.email} · ${item.role} · ${item.status}`;
const handleUserDirectory = async (user, question, thread) => {
  const command = parse(question);
  if (!command) return null;
  const users = await visibleUsers(user);
  if (!users) return response("Tu rol no puede consultar el directorio de cuentas.");
  if (command.kind === "search") {
    const match = users.find((item) => item.email?.toLowerCase() === command.email);
    return response(match ? lineFor(match) : "No hay una cuenta visible con ese correo.");
  }
  const previous = thread.messages.at(-1)?.userDirectoryBrowse;
  if (command.next && previous?.type !== "USER_DIRECTORY") {
    return response("Primero escribe «Usuarios del sistema» o «Usuarios con rol Auditor».");
  }
  const role = command.next ? previous.role : command.role;
  const filtered = users.filter((item) => !role || item.role === role)
    .sort((a, b) => a.id - b.id);
  const offset = command.next ? previous.offset : 0;
  const page = filtered.slice(offset, offset + 10);
  if (!page.length) return response(offset ? "No hay más cuentas en esta lista. Escribe «Usuarios del sistema» para actualizarla."
    : "No hay cuentas visibles con ese filtro.");
  const nextOffset = offset + page.length;
  return response(`Cuentas visibles: ${filtered.length}${role ? ` con rol ${role}` : ""}; mostrando ${offset + 1} a ${nextOffset}. ${page.map(lineFor).join("; ")}.${nextOffset < filtered.length ? " Escribe «Siguientes usuarios» para continuar." : ""}`,
    { coverage: { partial: nextOffset < filtered.length },
      userDirectoryBrowse: { type: "USER_DIRECTORY", role, offset: nextOffset } });
};

module.exports = { parse, intent, visibleUsers, handleUserDirectory };
