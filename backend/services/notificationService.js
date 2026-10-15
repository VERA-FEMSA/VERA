const { ROLES, PLANNING_APPROVE_ROLES, PLANNING_CREATE_ROLES } = require("../config/roles");

const isWithinDays = (date, now, days) => {
  if (!date) return false;
  const due = Date.parse(`${date}T23:59:59.999Z`);
  return Number.isFinite(due) && due >= now && due - now <= days * 24 * 60 * 60 * 1000;
};

const buildNotifications = ({ proposals, user, now = Date.now() }) => {
  const notifications = [];
  const isApprover = PLANNING_APPROVE_ROLES.includes(user.role);
  const canManage = PLANNING_CREATE_ROLES.includes(user.role);

  for (const proposal of proposals) {
    if (proposal.status === "OPEN" && isApprover) {
      notifications.push({
        id: `PROPOSAL_REVIEW:${proposal.id}`,
        type: "PROPOSAL_REVIEW",
        title: "Propuesta pendiente de decisión",
        description: `${proposal.title} · ${proposal.area}`,
        entityId: proposal.id,
        priority: proposal.risk === "Alto" ? "HIGH" : "MEDIUM",
        createdAt: proposal.createdAt,
        dueAt: null,
        path: "/planificacion"
      });
    }

    if (proposal.status === "OPEN" && user.role === ROLES.GERENTE && proposal.createdBy?.id === user.id) {
      notifications.push({
        id: `PROPOSAL_TRACK:${proposal.id}`,
        type: "PROPOSAL_TRACK",
        title: "Propuesta esperando revisión",
        description: `${proposal.title} · ${proposal.area}`,
        entityId: proposal.id,
        priority: "LOW",
        createdAt: proposal.createdAt,
        dueAt: null,
        path: "/planificacion"
      });
    }

    if (proposal.status === "APPROVED" && canManage) {
      notifications.push({
        id: `AUDIT_START:${proposal.id}`,
        type: "AUDIT_START",
        title: "Auditoría aprobada lista para iniciar",
        description: `${proposal.title} · ${proposal.quarter || "Trimestre por definir"} ${proposal.year}`,
        entityId: proposal.id,
        priority: "MEDIUM",
        createdAt: proposal.approvedAt || proposal.createdAt,
        dueAt: proposal.startDate || null,
        path: "/auditorias-activas"
      });
    }

    if (proposal.status === "ACTIVE" && proposal.responsibleId === user.id) {
      const overdue = proposal.endDate && Date.parse(`${proposal.endDate}T23:59:59.999Z`) < now;
      const dueSoon = isWithinDays(proposal.endDate, now, 7);
      notifications.push({
        id: `AUDIT_FOLLOW_UP:${proposal.id}`,
        type: "AUDIT_FOLLOW_UP",
        title: overdue ? "Auditoría con fecha de cierre vencida" : dueSoon ? "Auditoría próxima a su fecha de cierre" : "Auditoría activa asignada",
        description: `${proposal.title} · ${proposal.area}`,
        entityId: proposal.id,
        priority: overdue ? "HIGH" : dueSoon ? "MEDIUM" : "LOW",
        createdAt: proposal.startedAt || proposal.createdAt,
        dueAt: proposal.endDate || null,
        path: "/auditorias-activas"
      });
    }
  }

  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
};

module.exports = { buildNotifications };
