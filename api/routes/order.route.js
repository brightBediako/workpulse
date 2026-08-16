import express from "express";
import { verifyToken } from "../middlewares/jwt.js";
import {
  getOrders,
  getOrder,
  bookGig,
  intent,
  confirm,
  submitOrderWork,
  approveOrderWork,
  payOrder,
  completeOrder,
  openDispute,
} from "../controllers/order.controller.js";

const router = express.Router();

router.get("/", verifyToken, getOrders);
router.get("/:id", verifyToken, getOrder);
router.post("/book/:id", verifyToken, bookGig);
router.post("/create-payment-intent/:id", verifyToken, intent);
router.put("/", verifyToken, confirm);
router.put("/:id/submit-work", verifyToken, submitOrderWork);
router.put("/:id/approve-work", verifyToken, approveOrderWork);
router.post("/:id/payment-intent", verifyToken, payOrder);
router.put("/:id/complete", verifyToken, completeOrder);
router.post("/:id/dispute", verifyToken, openDispute);

export default router;
