import Notification from "../models/notification.model.js";
import { emitToUser } from "../socket/index.js";

/**
 * Persist an in-app notification. Failures are logged and swallowed
 * so domain flows (orders, gigs, messages) are not blocked.
 * When Socket.IO is up, also pushes `notification:new` + badge count.
 */
export const createNotification = async ({
  userId,
  message,
  type = "general",
  link = null,
}) => {
  if (!userId || !message) return null;

  try {
    const notification = await Notification.create({
      user: userId,
      message,
      type,
      link: link || undefined,
      read: false,
    });

    let unreadCount = null;
    try {
      unreadCount = await Notification.countDocuments({
        user: userId,
        read: false,
      });
    } catch {
      unreadCount = null;
    }

    emitToUser(userId, "notification:new", {
      notification,
      unreadCount,
    });
    emitToUser(userId, "notification:badge", { unreadCount });

    return notification;
  } catch (err) {
    console.error("createNotification failed:", err?.message || err);
    return null;
  }
};

/** Push updated unread badge after mark-read (REST remains source of truth). */
export const emitNotificationBadge = async (userId) => {
  if (!userId) return;
  try {
    const unreadCount = await Notification.countDocuments({
      user: userId,
      read: false,
    });
    emitToUser(userId, "notification:badge", { unreadCount });
  } catch (err) {
    console.error("emitNotificationBadge failed:", err?.message || err);
  }
};
