import express from "express";
import {
  getMe,
  getUser,
  updateUser,
  deleteUser,
  getMyVerification,
  submitVerification,
  uploadVerificationDocuments,
  getMyPayout,
  setMyPayout,
  getMyEarnings,
  discoverWorkers,
  getMyAvailability,
  setMyAvailability,
  getUserAvailability,
  getMyEmployer,
  setMyEmployer,
} from "../controllers/user.controller.js";
import { verifyToken } from "../middlewares/jwt.js";
import { verificationUpload } from "../middlewares/upload.js";

const router = express.Router();

// Specific paths before /:id
router.get("/me", verifyToken, getMe);
router.get("/workers", discoverWorkers);
router.get("/me/verification", verifyToken, getMyVerification);
router.put("/me/verification", verifyToken, submitVerification);
router.post(
  "/me/verification/upload",
  verifyToken,
  verificationUpload.array("documents", 5),
  uploadVerificationDocuments
);
router.get("/me/payout", verifyToken, getMyPayout);
router.put("/me/payout", verifyToken, setMyPayout);
router.get("/me/earnings", verifyToken, getMyEarnings);
router.get("/me/availability", verifyToken, getMyAvailability);
router.put("/me/availability", verifyToken, setMyAvailability);
router.get("/me/employer", verifyToken, getMyEmployer);
router.put("/me/employer", verifyToken, setMyEmployer);

router.get("/:id/availability", getUserAvailability);
router.get("/:id", getUser);
router.put("/update/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);

export default router;
