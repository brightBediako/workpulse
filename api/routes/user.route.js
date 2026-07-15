import express from "express";
import {
  getUser,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";
import { verifyToken } from "../middlewares/jwt.js";

const router = express.Router();

router.get("/:id", getUser);
router.put("/update/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);

export default router;
