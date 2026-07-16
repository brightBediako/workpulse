import Gig from "../models/gig.model.js";
import { createError } from "../middlewares/globalErrHandler.js";
import {
  GIG_CATEGORY_SLUGS,
  normalizeCategorySlug,
} from "../constants/gigCategories.js";
import {
  locationTextFilter,
  parseLocationInput,
} from "../utils/location.js";
import { normalizeCoverUrl } from "../utils/coverUrl.js";
import jwt from "jsonwebtoken";

const invalidCategoryError = () =>
  createError(
    400,
    `Invalid category. Use one of: ${GIG_CATEGORY_SLUGS.join(", ")} (see GET /api/categories).`
  );

const resolveOptionalUserId = (req) => {
  try {
    const cookieToken = req.cookies?.accessToken;
    const header = req.headers.authorization || req.headers.Authorization;
    const bearer =
      typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice(7).trim()
        : null;
    const token = cookieToken || bearer;
    if (!token || !process.env.JWT_KEY) return null;
    const payload = jwt.verify(token, process.env.JWT_KEY);
    return payload?.id ? String(payload.id) : null;
  } catch {
    return null;
  }
};

const applyLocationFromBody = (body) => {
  try {
    return parseLocationInput(body);
  } catch (err) {
    if (err.status === 400) {
      throw createError(400, err.message);
    }
    throw err;
  }
};

export const createGig = async (req, res, next) => {
  if (!req.isSeller) {
    return next(createError(403, "Only sellers can create gigs!"));
  }

  const catSlug = normalizeCategorySlug(req.body.cat);
  if (!catSlug) {
    return next(invalidCategoryError());
  }

  let location;
  try {
    location = applyLocationFromBody(req.body);
  } catch (err) {
    return next(err);
  }

  let cover;
  try {
    cover = normalizeCoverUrl(req.body.cover, { required: true });
  } catch (err) {
    return next(err);
  }

  // Do not spread raw body — clients may send empty GeoJSON that breaks 2dsphere
  const payload = {
    userId: req.userId,
    title: req.body.title,
    desc: req.body.desc,
    cat: catSlug,
    price: req.body.price,
    cover,
    images: req.body.images,
    shortTitle: req.body.shortTitle,
    shortDesc: req.body.shortDesc,
    deliveryTime: req.body.deliveryTime,
    revisionNumber: req.body.revisionNumber,
    features: req.body.features,
  };
  if (location) {
    payload.location = location;
  }

  const newGig = new Gig(payload);

  try {
    const savedGig = await newGig.save();
    res.status(201).json(savedGig);
  } catch (err) {
    next(err);
  }
};

export const deleteGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));

    if (String(gig.userId) !== String(req.userId)) {
      return next(createError(403, "You can delete only your gigs!"));
    }

    await Gig.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Gig has been deleted." });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/gigs/:id/suspend — owner pauses listing */
export const suspendOwnGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));
    if (String(gig.userId) !== String(req.userId)) {
      return next(createError(403, "You can suspend only your gigs!"));
    }
    if (gig.status === "suspended") {
      return next(createError(400, "Gig is already suspended."));
    }
    if (gig.status === "rejected") {
      return next(createError(400, "Rejected gigs cannot be suspended."));
    }

    gig.status = "suspended";
    if (typeof req.body?.reason === "string" && req.body.reason.trim()) {
      gig.rejectionReason = req.body.reason.trim().slice(0, 500);
    }
    await gig.save();

    res.status(200).json({
      message: "Gig suspended. It is hidden from the marketplace.",
      gig,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/gigs/:id/resume — owner re-submits suspended listing for approval */
export const resumeOwnGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));
    if (String(gig.userId) !== String(req.userId)) {
      return next(createError(403, "You can resume only your gigs!"));
    }
    if (gig.status !== "suspended") {
      return next(createError(400, "Only suspended gigs can be resumed."));
    }

    gig.status = "pending";
    gig.rejectionReason = undefined;
    await gig.save();

    res.status(200).json({
      message: "Gig re-submitted for admin approval.",
      gig,
    });
  } catch (err) {
    next(err);
  }
};

export const updateGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));
    if (String(gig.userId) !== String(req.userId)) {
      return next(createError(403, "You can update only your gigs!"));
    }

    const wasApproved = gig.status === "approved";
    const updates = { ...req.body };
    if (updates.cat !== undefined) {
      const catSlug = normalizeCategorySlug(updates.cat);
      if (!catSlug) {
        return next(invalidCategoryError());
      }
      updates.cat = catSlug;
    }

    if (
      updates.location !== undefined ||
      updates.city !== undefined ||
      updates.region !== undefined ||
      updates.area !== undefined ||
      updates.lat !== undefined ||
      updates.lng !== undefined
    ) {
      try {
        const location = applyLocationFromBody(updates);
        if (location) {
          updates.location = location;
        } else {
          delete updates.location;
        }
      } catch (err) {
        return next(err);
      }
    }

    delete updates.city;
    delete updates.region;
    delete updates.area;
    delete updates.country;
    delete updates.lat;
    delete updates.lng;
    delete updates.latitude;
    delete updates.longitude;

    // Sellers should not self-approve via update
    delete updates.status;
    delete updates.approvedBy;
    delete updates.approvedAt;
    delete updates.rejectionReason;
    delete updates.adminNotes;
    delete updates.sales;
    delete updates.totalStars;
    delete updates.starNumber;
    delete updates.userId;

    if (updates.cover !== undefined) {
      try {
        updates.cover = normalizeCoverUrl(updates.cover, { required: true });
      } catch (err) {
        return next(err);
      }
    }

    // Content changes on a live gig need re-approval
    if (wasApproved || gig.status === "suspended") {
      updates.status = "pending";
      updates.approvedBy = undefined;
      updates.approvedAt = undefined;
    }

    const updatedGig = await Gig.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.status(200).json(updatedGig);
  } catch (err) {
    next(err);
  }
};

export const getGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));
    res.status(200).send(gig);
  } catch (err) {
    next(err);
  }
};

export const getGigs = async (req, res, next) => {
  const q = req.query;
  const viewerId = resolveOptionalUserId(req);
  const viewingOwn =
    q.userId && viewerId && String(q.userId) === String(viewerId);

  const filters = {
    ...(q.userId && { userId: q.userId }),
    ...(q.min || q.max
      ? {
          price: {
            ...(q.min && { $gte: Number(q.min) }),
            ...(q.max && { $lte: Number(q.max) }),
          },
        }
      : {}),
    ...(q.search && { title: { $regex: q.search, $options: "i" } }),
    ...(req.isAdmin || viewingOwn ? {} : { status: "approved" }),
  };

  if (q.cat) {
    const catSlug = normalizeCategorySlug(q.cat);
    if (!catSlug) {
      return next(invalidCategoryError());
    }
    filters.cat = catSlug;
  }

  const cityFilter = locationTextFilter("location.city", q.city);
  const regionFilter = locationTextFilter("location.region", q.region);
  const countryFilter = locationTextFilter("location.country", q.country);
  Object.assign(filters, cityFilter, regionFilter, countryFilter);

  const lat = q.lat !== undefined ? Number(q.lat) : NaN;
  const lng = q.lng !== undefined ? Number(q.lng) : NaN;
  const radiusKm =
    q.radiusKm !== undefined ? Number(q.radiusKm) : q.radius !== undefined
      ? Number(q.radius)
      : NaN;

  const useGeo =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(radiusKm) &&
    radiusKm > 0;

  try {
    const sortField = q.sort || "createdAt";

    if (useGeo) {
      const radiusMeters = radiusKm * 1000;
      const gigs = await Gig.find({
        ...filters,
        "location.coordinates": {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
            $maxDistance: radiusMeters,
          },
        },
      }).limit(Math.min(Number(q.limit) || 50, 100));
      return res.status(200).send(gigs);
    }

    const gigs = await Gig.find(filters).sort({ [sortField]: -1 });
    res.status(200).send(gigs);
  } catch (err) {
    next(err);
  }
};
