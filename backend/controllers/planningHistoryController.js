const commentRepository = require("../repositories/commentRepository");
const { query } = require("../services/auditLogger");
const { findVisibleProposal, createCommentForUser } = require("../services/planningCommentService");

const visibleOr404 = async (id, user, res) => {
  try { return await findVisibleProposal(user, id); }
  catch (error) {
    if (error.status === 404) { res.status(404).json({ message: error.message }); return null; }
    throw error;
  }
};

const getHistory = async (req, res) => {
  const proposal = await visibleOr404(req.params.id, req.user, res);
  if (!proposal) return;
  res.json({
    history: await query({ entityId: proposal.id, limit: 200 }),
    comments: await commentRepository.listByProposal(proposal.id)
  });
};

const addComment = async (req, res) => {
  try {
    const comment = await createCommentForUser(req.user, req.params.id, req.body);
    return res.status(201).json({ comment });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};

module.exports = { getHistory, addComment };
