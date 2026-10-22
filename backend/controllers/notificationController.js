const planningRepository = require("../repositories/planningRepository");
const { buildNotifications } = require("../services/notificationService");
const { listActions } = require("../services/actionService");
const readRepository = require("../repositories/notificationReadRepository");
const { logActivity } = require("../services/auditLogger");

const clientOffset = (request) => {
  const value = typeof request.query.offsetMinutes === "string" ? Number(request.query.offsetMinutes) : NaN;
  return Number.isInteger(value) && value >= -840 && value <= 840 ? value : 0;
};

const visibleNotifications = async (user, offsetMinutes) => {
  const proposals = await planningRepository.getAll();
  try {
    const actions = await listActions(user);
    return { notifications: buildNotifications({ proposals, actions, user, offsetMinutes }), actionAlertsAvailable: true };
  } catch {
    return { notifications: buildNotifications({ proposals, user, offsetMinutes }), actionAlertsAvailable: false };
  }
};

const listNotifications = async (req, res) => {
  const reads = new Map((await readRepository.getForUser(req.user.id)).map((item) => [item.notificationId, item.readAt]));
  const result = await visibleNotifications(req.user, clientOffset(req));
  const notifications = result.notifications.map((item) => ({ ...item, readAt: reads.get(item.id) || null }));
  res.json({ notifications, actionAlertsAvailable: result.actionAlertsAvailable,
    generatedAt: new Date().toISOString(), persisted: process.env.VERA_NOTIFICATION_STORE === "supabase" });
};

const changeReadState = async (req, res, read) => {
  const { notifications } = await visibleNotifications(req.user, clientOffset(req));
  const notification = notifications.find((item) => item.id === req.params.id);
  if (!notification) return res.status(404).json({ message: "Pendiente no encontrado." });
  let readAt = null;
  if (read) readAt = await readRepository.markRead(req.user.id, notification.id);
  else await readRepository.markUnread(req.user.id, notification.id);
  const subject = notification.type.startsWith("ACTION_")
    ? { actionId: notification.entityId } : { proposalId: notification.entityId };
  await logActivity({ actor: req.user, action: read ? "NOTIFICATION_READ" : "NOTIFICATION_UNREAD", details: {
    notificationId: notification.id, ...subject
  } });
  res.json({ notificationId: notification.id, readAt });
};

const markRead = (req, res) => changeReadState(req, res, true);
const markUnread = (req, res) => changeReadState(req, res, false);

module.exports = { listNotifications, markRead, markUnread };
