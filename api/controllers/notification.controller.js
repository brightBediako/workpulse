import Notification from "../models/notification.model.js";
import { createError } from "../middlewares/globalErrHandler.js";
import { emitNotificationBadge } from "../services/notificationService.js";

/** GET /api/notifications?unreadOnly=true&limit=50 */
export const getNotifications = async (req, res, next) => {
  try {
    const unreadOnly =
      req.query.unreadOnly === "true" || req.query.unreadOnly === "1";
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10) || 50, 1),
      100
    );

    const filter = { user: req.userId };
    if (unreadOnly) filter.read = false;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ user: req.userId, read: false }),
    ]);

    res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/notifications/:id/read */
export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!notification) {
      return next(createError(404, "Notification not found!"));
    }

    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();
      await emitNotificationBadge(req.userId);
    }

    res.status(200).json({
      message: "Notification marked as read.",
      notification,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/notifications/read-all */
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { user: req.userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    await emitNotificationBadge(req.userId);

    res.status(200).json({
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount ?? result.nModified ?? 0,
    });
  } catch (err) {
    next(err);
  }
};
