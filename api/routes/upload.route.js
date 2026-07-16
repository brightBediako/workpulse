import express from "express";
import { verifyToken } from "../middlewares/jwt.js";
import { coverImageUpload } from "../middlewares/upload.js";
import { uploadCoverImage } from "../controllers/upload.controller.js";

const router = express.Router();

router.post(
  "/cover",
  verifyToken,
  coverImageUpload.single("cover"),
  uploadCoverImage
);

export default router;
