import express from "express";
import {
  createServiceRequest,
  getServiceRequests,
  getMyServiceRequests,
  getSellerInbox,
  getServiceRequest,
  updateServiceRequest,
  cancelServiceRequest,
  acceptServiceRequest,
  rejectServiceRequest,
  completeServiceRequest,
} from "../controllers/serviceRequest.controller.js";
import { verifyToken } from "../middlewares/jwt.js";

const router = express.Router();

router.get("/mine", verifyToken, getMyServiceRequests);
router.get("/inbox", verifyToken, getSellerInbox);

router.post("/", verifyToken, createServiceRequest);
router.get("/", getServiceRequests);

router.put("/:id/accept", verifyToken, acceptServiceRequest);
router.put("/:id/reject", verifyToken, rejectServiceRequest);
router.put("/:id/complete", verifyToken, completeServiceRequest);

router.get("/:id", getServiceRequest);
router.put("/:id", verifyToken, updateServiceRequest);
router.delete("/:id", verifyToken, cancelServiceRequest);

export default router;
