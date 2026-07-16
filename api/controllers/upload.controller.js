import { createError } from "../middlewares/globalErrHandler.js";

/** POST /api/uploads/cover — multipart field `cover` → public /uploads/covers/… URL */
export const uploadCoverImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(createError(400, "Attach an image file (PNG, JPG, or WEBP)."));
    }
    const url = `/uploads/covers/${req.file.filename}`;
    res.status(201).json({
      message: "Cover image uploaded.",
      url,
      cover: url,
    });
  } catch (err) {
    next(err);
  }
};
