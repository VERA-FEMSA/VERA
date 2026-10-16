const planningRepository = require("../repositories/planningRepository");
const commentRepository = require("../repositories/commentRepository");
const { query, logActivity } = require("../services/auditLogger");
const { ROLES } = require("../config/roles");

const canView = (proposal, user) => user.role !== ROLES.AUDITOR || proposal.responsibleId === user.id;
const findVisibleProposal = async (id, user, res) => {
  const proposal = await planningRepository.findById(id);
  if (!proposal) {
    res.status(404).json({ message: "Propuesta de auditoría no encontrada." });
    return null;
  }
  if (!canView(proposal, user)) {
    res.status(404).json({ message: "Propuesta de auditoría no encontrada." });
    return null;
  }
  return proposal;
};

const getHistory = async (req, res) => {
  const proposal = await findVisibleProposal(req.params.id, req.user, res);
  if (!proposal) return;
  res.json({
    history: query({ entityId: proposal.id, limit: 200 }),
    comments: await commentRepository.listByProposal(proposal.id)
  });
};

const addComment = async (req, res) => {
  const proposal = await findVisibleProposal(req.params.id, req.user, res);
  if (!proposal) return;
  const text = String(req.body.text ?? "").trim();
  if (text.length < 3 || text.length > 2000) {
    return res.status(400).json({ message: "El comentario debe tener entre 3 y 2,000 caracteres." });
  }

  const comment = await commentRepository.create({
    proposalId: proposal.id,
    text,
    author: { id: req.user.id, username: req.user.username, role: req.user.role }
  });
  logActivity({
    actor: req.user,
    action: "AUDIT_COMMENT_ADDED",
    details: { proposalId: proposal.id, title: proposal.title, commentId: comment.id }
  });
  res.status(201).json({ comment });
};

module.exports = { getHistory, addComment };
