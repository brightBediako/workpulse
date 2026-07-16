import express from "express";
import {
  getUser,
  updateUser,
  deleteUser,
  getMyVerification,
  submitVerification,
  discoverWorkers,
  getMyAvailability,
  setMyAvailability,
  getUserAvailability,
  getMyEmployer,
  setMyEmployer,
} from "../controllers/user.controller.js";
import { verifyToken } from "../middlewares/jwt.js";

const router = express.Router();

// Specific paths before /:id
router.get("/workers", discoverWorkers);
router.get("/me/verification", verifyToken, getMyVerification);
router.put("/me/verification", verifyToken, submitVerification);
router.get("/me/availability", verifyToken, getMyAvailability);
router.put("/me/availability", verifyToken, setMyAvailability);
router.get("/me/employer", verifyToken, getMyEmployer);
router.put("/me/employer", verifyToken, setMyEmployer);

router.get("/:id/availability", getUserAvailability);
router.get("/:id", getUser);
router.put("/update/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);

export default router;
