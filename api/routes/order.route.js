import express from "express";
import { verifyToken } from "../middlewares/jwt.js";
import {
  getOrders,
  getOrder,
  intent,
  confirm,
  completeOrder,
  openDispute,
} from "../controllers/order.controller.js";

const router = express.Router();

router.get("/", verifyToken, getOrders);
router.get("/:id", verifyToken, getOrder);
router.post("/create-payment-intent/:id", verifyToken, intent);
router.put("/", verifyToken, confirm);
router.put("/:id/complete", verifyToken, completeOrder);
router.post("/:id/dispute", verifyToken, openDispute);

export default router;
