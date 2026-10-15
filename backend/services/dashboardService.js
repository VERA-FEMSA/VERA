const { PLANNING_APPROVE_ROLES, PLANNING_CREATE_ROLES } = require("../config/roles");
const { classifyRisk } = require("../config/riskRules");

const dashboardCopy = {
  SUPER_ADMIN: {
    title: "Control ejecutivo del portafolio",
    description: "Riesgos, decisiones y ejecución de todas las auditorías.",
    scopeLabel: "Portafolio completo"
  },
  DIRECTOR: {
    title: "Decisiones del portafolio",
    description: "Prioriza propuestas y da seguimiento a la ejecución.",
    scopeLabel: "Portafolio completo"
  },
  GERENTE: {
    title: "Seguimiento de planeación",
    description: "Revisa propuestas abiertas y el avance del plan anual.",
    scopeLabel: "Planeación"
  },
  AUDITOR: {
    title: "Mis auditorías asignadas",
    description: "Consulta tu carga, prioridades y auditorías en curso.",
    scopeLabel: "Solo mis asignaciones"
  },
  JEFATURA: {
    title: "Seguimiento del portafolio",
    description: "Consulta el estado general y las prioridades de auditoría.",
    scopeLabel: "Vista de consulta"
  }
};

const getDashboardForUser = (user, proposals) => {
  const isAuditor = user.role === "AUDITOR";
  const visibleProposals = isAuditor
    ? proposals.filter((proposal) => proposal.responsibleId === user.id)
    : proposals;
  const activeAudits = visibleProposals.filter((proposal) => proposal.status === "ACTIVE");
  const executingAudits = visibleProposals.filter((proposal) => ["ACTIVE", "CLOSED"].includes(proposal.status));
  const statusCounts = ["OPEN", "APPROVED", "ACTIVE", "CLOSED", "REJECTED"].map((status) => ({
    status,
    count: visibleProposals.filter((proposal) => proposal.status === status).length
  }));
  const riskMatrix = [1, 2, 3].map((likelihood) => [1, 2, 3].map((impact) => {
    const score = likelihood * impact;
    return {
      likelihood,
      impact,
      risk: classifyRisk(score),
      count: activeAudits.filter((audit) => (audit.likelihood ?? 2) === likelihood && (audit.impact ?? 2) === impact).length
    };
  }));
  const pendingItems = PLANNING_APPROVE_ROLES.includes(user.role)
    ? visibleProposals.filter((proposal) => proposal.status === "OPEN")
    : user.role === "AUDITOR"
      ? visibleProposals.filter((proposal) => ["OPEN", "APPROVED", "ACTIVE"].includes(proposal.status))
      : PLANNING_CREATE_ROLES.includes(user.role)
        ? visibleProposals.filter((proposal) => proposal.status === "OPEN")
        : visibleProposals.filter((proposal) => proposal.status === "ACTIVE");

  const heading = dashboardCopy[user.role] || dashboardCopy.JEFATURA;
  return {
    role: user.role,
    ...heading,
    metrics: {
      total: visibleProposals.length,
      pending: visibleProposals.filter((proposal) => proposal.status === "OPEN").length,
      active: activeAudits.length,
      highRisk: visibleProposals.filter((proposal) => proposal.risk === "Alto").length,
      averageProgress: executingAudits.length
        ? Math.round(executingAudits.reduce((total, proposal) => total + (proposal.progress ?? 0), 0) / executingAudits.length)
        : 0
    },
    statusCounts,
    riskMatrix,
    pendingItems: pendingItems.slice(0, 8).map((proposal) => ({
      id: proposal.id,
      title: proposal.title,
      area: proposal.area,
      status: proposal.status,
      risk: proposal.risk,
      quarter: proposal.quarter,
      year: proposal.year,
      progress: proposal.progress ?? 0
    })),
    permissions: {
      canCreate: PLANNING_CREATE_ROLES.includes(user.role),
      canApprove: PLANNING_APPROVE_ROLES.includes(user.role),
      canManageExecution: PLANNING_APPROVE_ROLES.includes(user.role)
    }
  };
};

module.exports = { getDashboardForUser };
