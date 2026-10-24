const { visibleNotifications, changeReadStateForUser } = require("../services/notificationWorkflowService");

const clientOffset = (request) => {
  const value = typeof request.query.offsetMinutes === "string" ? Number(request.query.offsetMinutes) : NaN;
  return Number.isInteger(value) && value >= -840 && value <= 840 ? value : 0;
};

const listNotifications = async (req, res) => {
  const result = await visibleNotifications(req.user, clientOffset(req));
  res.json({ notifications: result.notifications, actionAlertsAvailable: result.actionAlertsAvailable,
    generatedAt: new Date().toISOString(), persisted: process.env.VERA_NOTIFICATION_STORE === "supabase" });
};

const changeReadState = async (req, res, read) => {
  try { return res.json(await changeReadStateForUser(req.user, req.params.id, read,
    { offsetMinutes: clientOffset(req) })); }
  catch (error) {
    if ([400, 403, 404, 409, 503].includes(error.status)) return res.status(error.status).json({ message: error.message });
    throw error;
  }
};

const markRead = (req, res) => changeReadState(req, res, true);
const markUnread = (req, res) => changeReadState(req, res, false);

module.exports = { listNotifications, markRead, markUnread };
