import ServiceRequest from "../models/serviceRequest.model.js";
import User from "../models/user.model.js";
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
import { createNotification } from "../services/notificationService.js";

const invalidCategoryError = () =>
  createError(
    400,
    `Invalid category. Use one of: ${GIG_CATEGORY_SLUGS.join(", ")} (see GET /api/categories).`
  );

const assertCustomerOwner = (doc, userId) => {
  if (String(doc.customerId) !== String(userId)) {
    throw createError(403, "You can manage only your own service requests.");
  }
};

const requireSeller = async (userId) => {
  const user = await User.findById(userId).select("isSeller username isBanned");
  if (!user) throw createError(404, "User not found!");
  if (user.isBanned) throw createError(403, "Banned accounts cannot respond.");
  if (!user.isSeller) {
    throw createError(
      403,
      "Only workers (sellers) can accept or reject service requests."
    );
  }
  return user;
};

/** POST /api/service-requests — any authenticated customer */
export const createServiceRequest = async (req, res, next) => {
  try {
    const title =
      typeof req.body.title === "string" ? req.body.title.trim() : "";
    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : typeof req.body.desc === "string"
          ? req.body.desc.trim()
          : "";

    if (!title) return next(createError(400, "title is required."));
    if (!description) return next(createError(400, "description is required."));

    const catSlug = normalizeCategorySlug(req.body.cat);
    if (!catSlug) return next(invalidCategoryError());

    let location;
    try {
      location = parseLocationInput(req.body);
    } catch (err) {
      return next(err.status === 400 ? createError(400, err.message) : err);
    }

    let budget;
    if (req.body.budget !== undefined && req.body.budget !== null && req.body.budget !== "") {
      budget = Number(req.body.budget);
      if (!Number.isFinite(budget) || budget < 0) {
        return next(createError(400, "budget must be a non-negative number."));
      }
    }

    let preferredDate;
    if (req.body.preferredDate) {
      preferredDate = new Date(req.body.preferredDate);
      if (Number.isNaN(preferredDate.getTime())) {
        return next(createError(400, "preferredDate must be a valid date."));
      }
    }

    let sellerId =
      req.body.sellerId !== undefined && req.body.sellerId !== null
        ? String(req.body.sellerId).trim()
        : undefined;
    let gigId =
      req.body.gigId !== undefined && req.body.gigId !== null
        ? String(req.body.gigId).trim()
        : undefined;

    if (gigId) {
      const gig = await Gig.findById(gigId).select("userId status cat");
      if (!gig) return next(createError(404, "Gig not found!"));
      if (!sellerId) sellerId = String(gig.userId);
      if (String(gig.userId) !== String(sellerId)) {
        return next(
          createError(400, "sellerId must match the gig owner when gigId is set.")
        );
      }
    }

    if (sellerId) {
      if (String(sellerId) === String(req.userId)) {
        return next(createError(400, "You cannot direct a request to yourself."));
      }
      const seller = await User.findById(sellerId).select("isSeller");
      if (!seller || !seller.isSeller) {
        return next(createError(400, "Target sellerId must be a worker account."));
      }
    }

    const request = await ServiceRequest.create({
      customerId: String(req.userId),
      title,
      description,
      cat: catSlug,
      location: location || undefined,
      budget,
      currency:
        typeof req.body.currency === "string" && req.body.currency.trim()
          ? req.body.currency.trim().slice(0, 8)
          : "GHS",
      preferredDate,
      sellerId: sellerId || undefined,
      gigId: gigId || undefined,
      status: "open",
    });

    if (sellerId) {
      const customer = await User.findById(req.userId).select("username");
      await createNotification({
        userId: sellerId,
        type: "service_request",
        message: `${customer?.username || "A customer"} sent you a service request: ${title}`,
        link: `/service-requests/${request._id}`,
      });
    }

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

/** GET /api/service-requests — open board (undirected) + filters */
export const getServiceRequests = async (req, res, next) => {
  try {
    const q = req.query;
    const filter = {};

    if (q.status) {
      filter.status = q.status;
    } else {
      filter.status = "open";
    }

    // Public board = undirected open requests unless sellerId filter is set
    if (q.sellerId) {
      filter.sellerId = String(q.sellerId);
    } else if (q.directed === "true") {
      filter.sellerId = { $exists: true, $ne: null };
    } else if (q.openBoard !== "false") {
      filter.$or = [{ sellerId: { $exists: false } }, { sellerId: null }];
    }

    if (q.cat) {
      const catSlug = normalizeCategorySlug(q.cat);
      if (!catSlug) return next(invalidCategoryError());
      filter.cat = catSlug;
    }

    if (q.customerId) filter.customerId = String(q.customerId);

    const cityFilter = locationTextFilter("location.city", q.city);
    const regionFilter = locationTextFilter("location.region", q.region);
    Object.assign(filter, cityFilter || {}, regionFilter || {});

    const limit = Math.min(Math.max(Number(q.limit) || 40, 1), 100);
    const requests = await ServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ requests, count: requests.length });
  } catch (err) {
    next(err);
  }
};

/** GET /api/service-requests/mine — customer's own */
export const getMyServiceRequests = async (req, res, next) => {
  try {
    const filter = { customerId: String(req.userId) };
    if (req.query.status) filter.status = req.query.status;

    const requests = await ServiceRequest.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ requests, count: requests.length });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/service-requests/inbox — seller view:
 * directed-to-me (any open/accepted/…) + open undirected board (open only)
 */
export const getSellerInbox = async (req, res, next) => {
  try {
    await requireSeller(req.userId);

    const directed = await ServiceRequest.find({
      sellerId: String(req.userId),
      ...(req.query.status ? { status: req.query.status } : {}),
    }).sort({ createdAt: -1 });

    const openBoard = await ServiceRequest.find({
      status: "open",
      $or: [{ sellerId: { $exists: false } }, { sellerId: null }],
      ...(req.query.cat
        ? { cat: normalizeCategorySlug(req.query.cat) || req.query.cat }
        : {}),
    })
      .sort({ createdAt: -1 })
      .limit(40);

    res.status(200).json({
      directed,
      openBoard,
      count: directed.length + openBoard.length,
    });
  } catch (err) {
    next(err.statusCode ? err : err);
  }
};

/** GET /api/service-requests/:id */
export const getServiceRequest = async (req, res, next) => {
  try {
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return next(createError(404, "Service request not found!"));
    res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/service-requests/:id — customer updates while open */
export const updateServiceRequest = async (req, res, next) => {
  try {
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return next(createError(404, "Service request not found!"));
    assertCustomerOwner(doc, req.userId);

    if (doc.status !== "open") {
      return next(
        createError(400, `Cannot update a request with status "${doc.status}".`)
      );
    }

    if (req.body.title !== undefined) {
      const title =
        typeof req.body.title === "string" ? req.body.title.trim() : "";
      if (!title) return next(createError(400, "title cannot be empty."));
      doc.title = title;
    }

    if (req.body.description !== undefined || req.body.desc !== undefined) {
      const description =
        typeof req.body.description === "string"
          ? req.body.description.trim()
          : typeof req.body.desc === "string"
            ? req.body.desc.trim()
            : "";
      if (!description) {
        return next(createError(400, "description cannot be empty."));
      }
      doc.description = description;
    }

    if (req.body.cat !== undefined) {
      const catSlug = normalizeCategorySlug(req.body.cat);
      if (!catSlug) return next(invalidCategoryError());
      doc.cat = catSlug;
    }

    if (
      req.body.location !== undefined ||
      req.body.city !== undefined ||
      req.body.region !== undefined ||
      req.body.country !== undefined ||
      req.body.lat !== undefined ||
      req.body.lng !== undefined
    ) {
      try {
        const location = parseLocationInput(req.body);
        if (location) doc.location = location;
      } catch (err) {
        return next(err.status === 400 ? createError(400, err.message) : err);
      }
    }

    if (req.body.budget !== undefined) {
      if (req.body.budget === null || req.body.budget === "") {
        doc.budget = undefined;
      } else {
        const budget = Number(req.body.budget);
        if (!Number.isFinite(budget) || budget < 0) {
          return next(createError(400, "budget must be a non-negative number."));
        }
        doc.budget = budget;
      }
    }

    if (req.body.preferredDate !== undefined) {
      if (!req.body.preferredDate) {
        doc.preferredDate = undefined;
      } else {
        const preferredDate = new Date(req.body.preferredDate);
        if (Number.isNaN(preferredDate.getTime())) {
          return next(createError(400, "preferredDate must be a valid date."));
        }
        doc.preferredDate = preferredDate;
      }
    }

    await doc.save();
    res.status(200).json(doc);
  } catch (err) {
    next(err.statusCode ? err : err);
  }
};

/** DELETE /api/service-requests/:id — customer cancels */
export const cancelServiceRequest = async (req, res, next) => {
  try {
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return next(createError(404, "Service request not found!"));
    assertCustomerOwner(doc, req.userId);

    if (doc.status === "completed" || doc.status === "cancelled") {
      return next(
        createError(400, `Request is already ${doc.status}.`)
      );
    }

    doc.status = "cancelled";
    await doc.save();

    if (doc.sellerId && doc.status === "cancelled") {
      await createNotification({
        userId: doc.sellerId,
        type: "general",
        message: `A service request was cancelled: ${doc.title}`,
        link: `/service-requests/${doc._id}`,
      });
    }

    res.status(200).json({ message: "Service request cancelled.", request: doc });
  } catch (err) {
    next(err.statusCode ? err : err);
  }
};

/** PUT /api/service-requests/:id/accept — seller accepts / claims */
export const acceptServiceRequest = async (req, res, next) => {
  try {
    const seller = await requireSeller(req.userId);
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return next(createError(404, "Service request not found!"));

    if (doc.status !== "open") {
      return next(
        createError(400, `Request is ${doc.status}; only open requests can be accepted.`)
      );
    }

    if (String(doc.customerId) === String(req.userId)) {
      return next(createError(400, "You cannot accept your own request."));
    }

    if (doc.sellerId && String(doc.sellerId) !== String(req.userId)) {
      return next(
        createError(403, "This request is directed to another worker.")
      );
    }

    doc.status = "accepted";
    doc.acceptedBy = String(req.userId);
    doc.acceptedAt = new Date();
    if (!doc.sellerId) doc.sellerId = String(req.userId);
    if (typeof req.body.note === "string") {
      doc.responseNote = req.body.note.trim().slice(0, 500) || undefined;
    }
    await doc.save();

    await createNotification({
      userId: doc.customerId,
      type: "request_accepted",
      message: `${seller.username} accepted your service request: ${doc.title}`,
      link: `/service-requests/${doc._id}`,
    });

    res.status(200).json({
      message: "Service request accepted.",
      request: doc,
    });
  } catch (err) {
    next(err.statusCode ? err : err);
  }
};

/** PUT /api/service-requests/:id/reject — seller declines (directed) */
export const rejectServiceRequest = async (req, res, next) => {
  try {
    const seller = await requireSeller(req.userId);
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return next(createError(404, "Service request not found!"));

    if (doc.status !== "open") {
      return next(
        createError(400, `Request is ${doc.status}; only open requests can be rejected.`)
      );
    }

    if (!doc.sellerId) {
      return next(
        createError(
          400,
          "Open-board requests cannot be rejected; leave them or accept to claim."
        )
      );
    }

    if (String(doc.sellerId) !== String(req.userId)) {
      return next(
        createError(403, "This request is directed to another worker.")
      );
    }

    doc.status = "rejected";
    doc.rejectedAt = new Date();
    if (typeof req.body.note === "string") {
      doc.responseNote = req.body.note.trim().slice(0, 500) || undefined;
    }
    await doc.save();

    await createNotification({
      userId: doc.customerId,
      type: "request_rejected",
      message: `${seller.username} declined your service request: ${doc.title}`,
      link: `/service-requests/${doc._id}`,
    });

    res.status(200).json({
      message: "Service request rejected.",
      request: doc,
    });
  } catch (err) {
    next(err.statusCode ? err : err);
  }
};

/** PUT /api/service-requests/:id/complete — customer or accepted seller */
export const completeServiceRequest = async (req, res, next) => {
  try {
    const doc = await ServiceRequest.findById(req.params.id);
    if (!doc) return next(createError(404, "Service request not found!"));

    if (doc.status !== "accepted") {
      return next(
        createError(400, "Only accepted requests can be marked completed.")
      );
    }

    const isCustomer = String(doc.customerId) === String(req.userId);
    const isAcceptedSeller = String(doc.acceptedBy) === String(req.userId);
    if (!isCustomer && !isAcceptedSeller && !req.isAdmin) {
      return next(
        createError(403, "Only the customer or accepted worker can complete this.")
      );
    }

    doc.status = "completed";
    await doc.save();

    const notifyId = isCustomer ? doc.acceptedBy : doc.customerId;
    if (notifyId) {
      await createNotification({
        userId: notifyId,
        type: "general",
        message: `Service request marked completed: ${doc.title}`,
        link: `/service-requests/${doc._id}`,
      });
    }

    res.status(200).json({
      message: "Service request completed.",
      request: doc,
    });
  } catch (err) {
    next(err);
  }
};
