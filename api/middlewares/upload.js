import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createError } from "./globalErrHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
export const VERIFICATION_DIR = path.join(UPLOADS_ROOT, "verification");
export const COVERS_DIR = path.join(UPLOADS_ROOT, "covers");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(VERIFICATION_DIR);
ensureDir(COVERS_DIR);

const imageExts = [".png", ".jpg", ".jpeg", ".webp"];

function makeStorage(dir) {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      ensureDir(dir);
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
      const safeExt = imageExts.includes(ext)
        ? ext
        : file.mimetype === "image/png"
          ? ".png"
          : file.mimetype === "image/webp"
            ? ".webp"
            : ".jpg";
      const userId = String(req.userId || "anon");
      cb(
        null,
        `${userId}-${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExt}`
      );
    },
  });
}

const docMime = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const imageMime = new Set(["image/png", "image/jpeg", "image/webp"]);

export const verificationUpload = multer({
  storage: makeStorage(VERIFICATION_DIR),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter(_req, file, cb) {
    if (!docMime.has(file.mimetype)) {
      return cb(
        createError(400, "Only PDF, PNG, JPG, or WEBP files are allowed.")
      );
    }
    cb(null, true);
  },
});

export const coverImageUpload = multer({
  storage: makeStorage(COVERS_DIR),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (!imageMime.has(file.mimetype)) {
      return cb(createError(400, "Only PNG, JPG, or WEBP images are allowed."));
    }
    cb(null, true);
  },
});
