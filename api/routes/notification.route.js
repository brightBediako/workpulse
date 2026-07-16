import express from "express";
import { verifyToken } from "../middlewares/jwt.js";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", verifyToken, getNotifications);
router.put("/read-all", verifyToken, markAllNotificationsRead);
router.put("/:id/read", verifyToken, markNotificationRead);

export default router;
