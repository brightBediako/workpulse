import {
  GIG_CATEGORIES,
  GIG_CATEGORY_SLUGS,
} from "../constants/gigCategories.js";

/** GET /api/categories — public taxonomy for gig create/search */
export const getCategories = async (req, res, next) => {
  try {
    res.status(200).json({
      categories: GIG_CATEGORIES,
      slugs: GIG_CATEGORY_SLUGS,
    });
  } catch (err) {
    next(err);
  }
};
