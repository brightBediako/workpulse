import User from "../models/user.model.js";
import Gig from "../models/gig.model.js";
import Order from "../models/order.model.js";
import { createError } from "../middlewares/globalErrHandler.js";
import { normalizeCategorySlug } from "../constants/gigCategories.js";
import {
  locationTextFilter,
  parseLocationInput,
} from "../utils/location.js";
import { DEFAULT_COUNTRY } from "../constants/ghanaLocations.js";
import {
  isAvailableAt,
  parseAvailabilityInput,
} from "../utils/availability.js";
import jwt from "jsonwebtoken";
import { getAccessTokenCookieOptions } from "../utils/authCookies.js";
import {
  MAX_PAYOUT_ACCOUNTS,
  normalizePayoutAccountInput,
  resolvePayoutAccounts,
  serializePayoutAccount,
  syncLegacyPayoutFields,
} from "../utils/payoutValidation.js";
import { getSellerPayoutBalance } from "../utils/payoutBalance.js";

const PRIVILEGED_USER_FIELDS = [
  "password",
  "isAdmin",
  "isVerified",
  "isBanned",
  "banReason",
  "verificationStatus",
  "verificationDocuments",
  "verificationSubmittedAt",
  "adminNotes",
  "availability",
  "availabilityTimezone",
  "availabilityNote",
  "availabilityUpdatedAt",
  "payoutAccounts",
  "payoutMethod",
  "payoutProvider",
  "payoutAccountName",
  "payoutAccountNumber",
  "payoutUpdatedAt",
];

const accountModes = (user) => ({
  customer: true,
  worker: Boolean(user.isSeller),
  employer: Boolean(user.isEmployer),
  admin: Boolean(user.isAdmin),
});

const signAccessToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      isSeller: user.isSeller,
      isEmployer: user.isEmployer,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isAdmin,
    },
    process.env.JWT_KEY
  );

const isDocumentUrl = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.startsWith("/uploads/")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const publicUserView = (userDoc, { includeDocuments = false } = {}) => {
  const { password, adminNotes, verificationDocuments, ...rest } = userDoc;
  const availabilityPayload = {
    availability: rest.availability || [],
    availabilityTimezone: rest.availabilityTimezone || "Africa/Accra",
    availabilityNote: rest.availabilityNote || null,
    availabilityUpdatedAt: rest.availabilityUpdatedAt || null,
    availableNow: rest.isSeller
      ? isAvailableAt(
          rest.availability || [],
          rest.availabilityTimezone || "Africa/Accra"
        )
      : null,
  };
  const modes = accountModes(rest);
  const employerPayload = {
    isEmployer: Boolean(rest.isEmployer),
    companyName: rest.companyName || null,
    companyDesc: rest.companyDesc || null,
    accountModes: modes,
  };
  const payoutPayload = {
    payoutAccounts: resolvePayoutAccounts(rest).map((a) =>
      a._id === "legacy"
        ? {
            id: "legacy",
            method: a.method,
            provider: a.provider,
            accountName: a.accountName,
            accountNumber: a.accountNumber,
            label: null,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          }
        : serializePayoutAccount(a)
    ),
    payoutMethod: rest.payoutMethod || "none",
    payoutProvider: rest.payoutProvider || null,
    payoutAccountName: rest.payoutAccountName || null,
    payoutAccountNumber: rest.payoutAccountNumber || null,
    payoutUpdatedAt: rest.payoutUpdatedAt || null,
  };

  if (includeDocuments) {
    return {
      ...rest,
      verificationDocuments: verificationDocuments || [],
      adminNotes,
      ...availabilityPayload,
      ...employerPayload,
      ...payoutPayload,
    };
  }
  return {
    ...rest,
    isVerified: rest.isVerified,
    verificationStatus: rest.verificationStatus,
    ...availabilityPayload,
    ...employerPayload,
  };
};

/** GET /api/users/me — own full profile */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));
    const { password, ...info } = user._doc;
    res.status(200).json(publicUserView(info, { includeDocuments: true }));
  } catch (err) {
    next(err);
  }
};

// get user
export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    const isSelf = req.userId && String(req.userId) === String(user._id);
    const { password, ...info } = user._doc;
    res.status(200).send(
      publicUserView(info, { includeDocuments: Boolean(isSelf || req.isAdmin) })
    );
  } catch (err) {
    next(err);
  }
};

// update user
export const updateUser = async (req, res, next) => {
  try {
    if (String(req.userId) !== String(req.params.id)) {
      return next(createError(403, "You can update only your account!"));
    }

    const updates = { ...req.body };
    for (const field of PRIVILEGED_USER_FIELDS) {
      delete updates[field];
    }

    // Optional service-area location for workers
    if (
      updates.serviceCity !== undefined ||
      updates.serviceRegion !== undefined ||
      updates.serviceCountry !== undefined ||
      updates.serviceLat !== undefined ||
      updates.serviceLng !== undefined ||
      updates.serviceLocation !== undefined
    ) {
      try {
        const loc = parseLocationInput({
          location: updates.serviceLocation,
          city: updates.serviceCity,
          region: updates.serviceRegion,
          country: updates.serviceCountry || DEFAULT_COUNTRY,
          lat: updates.serviceLat,
          lng: updates.serviceLng,
        });
        if (loc) {
          if (loc.city) updates.serviceCity = loc.city;
          if (loc.region) updates.serviceRegion = loc.region;
          updates.serviceCountry = loc.country || DEFAULT_COUNTRY;
          if (loc.coordinates) {
            updates.serviceCoordinates = loc.coordinates;
          }
        }
      } catch (err) {
        return next(
          err.status === 400 ? createError(400, err.message) : err
        );
      }
      delete updates.serviceLocation;
      delete updates.serviceLat;
      delete updates.serviceLng;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updatedUser) return next(createError(404, "User not found!"));

    const { password, ...info } = updatedUser._doc;
    res.status(200).send(
      publicUserView(info, { includeDocuments: true })
    );
  } catch (err) {
    next(err);
  }
};

// delete user
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    if (String(req.userId) !== String(user._id)) {
      return next(createError(403, "You can delete only your account!"));
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "User has been deleted." });
  } catch (err) {
    next(err);
  }
};

/** GET /api/users/me/verification — own verification status + docs */
export const getMyVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "username isSeller isEmployer isVerified verificationStatus verificationDocuments verificationSubmittedAt adminNotes"
    );
    if (!user) return next(createError(404, "User not found!"));

    res.status(200).json({
      isSeller: user.isSeller,
      isEmployer: user.isEmployer,
      isVerified: user.isVerified,
      verificationStatus: user.verificationStatus,
      verificationDocuments: user.verificationDocuments || [],
      verificationSubmittedAt: user.verificationSubmittedAt || null,
      adminNotes:
        user.verificationStatus === "rejected" ? user.adminNotes || null : null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me/verification
 * Worker or employer submits document URLs for admin review.
 * Body: { "documents": ["https://…", "/uploads/…", …] }
 */
export const submitVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller && !user.isEmployer) {
      return next(
        createError(
          403,
          "Only workers or employers can submit verification documents."
        )
      );
    }

    if (user.verificationStatus === "verified" && user.isVerified) {
      return next(
        createError(400, "Account is already verified. Contact support to update documents.")
      );
    }

    const rawDocs = req.body.documents ?? req.body.verificationDocuments;
    if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
      return next(
        createError(400, "Provide a non-empty documents array of HTTPS or /uploads URLs.")
      );
    }

    if (rawDocs.length > 10) {
      return next(createError(400, "You can submit at most 10 document URLs."));
    }

    const documents = [
      ...new Set(
        rawDocs
          .map((d) => (typeof d === "string" ? d.trim() : ""))
          .filter(Boolean)
      ),
    ];

    if (documents.length === 0 || !documents.every(isDocumentUrl)) {
      return next(
        createError(400, "Each document must be a valid http(s) or /uploads URL.")
      );
    }

    user.verificationDocuments = documents;
    user.verificationStatus = "pending";
    user.isVerified = false;
    user.verificationSubmittedAt = new Date();
    await user.save();

    res.status(200).json({
      message: "Verification documents submitted. An admin will review them.",
      verificationStatus: user.verificationStatus,
      isVerified: user.isVerified,
      verificationDocuments: user.verificationDocuments,
      verificationSubmittedAt: user.verificationSubmittedAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/verification/upload
 * Multipart file upload; returns public URLs to include in verification submit.
 */
export const uploadVerificationDocuments = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller && !user.isEmployer) {
      return next(
        createError(
          403,
          "Only workers or employers can upload verification documents."
        )
      );
    }

    const files = req.files || [];
    if (!files.length) {
      return next(createError(400, "Attach at least one file (PDF, PNG, JPG, WEBP)."));
    }

    const urls = files.map((f) => `/uploads/verification/${f.filename}`);

    res.status(201).json({
      message: "Files uploaded. Submit them for admin review.",
      documents: urls,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/users/me/payout — list payout destinations */
export const getMyPayout = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "isSeller isEmployer payoutAccounts payoutMethod payoutProvider payoutAccountName payoutAccountNumber payoutUpdatedAt"
    );
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller && !user.isEmployer) {
      return next(
        createError(403, "Only workers or employers can manage payout settings.")
      );
    }

    const accounts = resolvePayoutAccounts(user).map((a) =>
      a._id === "legacy"
        ? {
            id: "legacy",
            method: a.method,
            provider: a.provider,
            accountName: a.accountName,
            accountNumber: a.accountNumber,
            label: null,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          }
        : serializePayoutAccount(a)
    );

    res.status(200).json({
      accounts,
      payoutUpdatedAt: user.payoutUpdatedAt || null,
      // Legacy single-destination fields (first account)
      payoutMethod: user.payoutMethod || "none",
      payoutProvider: user.payoutProvider || null,
      payoutAccountName: user.payoutAccountName || null,
      payoutAccountNumber: user.payoutAccountNumber || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Ensure legacy flat payout is migrated into payoutAccounts before mutating.
 */
const ensurePayoutAccountsMigrated = (user) => {
  if (Array.isArray(user.payoutAccounts) && user.payoutAccounts.length > 0) {
    return;
  }
  if (
    user.payoutMethod &&
    user.payoutMethod !== "none" &&
    user.payoutProvider &&
    user.payoutAccountName &&
    user.payoutAccountNumber
  ) {
    user.payoutAccounts = [
      {
        method: user.payoutMethod,
        provider: user.payoutProvider,
        accountName: user.payoutAccountName,
        accountNumber: String(user.payoutAccountNumber).replace(/\D/g, ""),
      },
    ];
  } else if (!Array.isArray(user.payoutAccounts)) {
    user.payoutAccounts = [];
  }
};

/**
 * POST /api/users/me/payout — add a MoMo or bank payout account
 * Body: { method, provider, accountName, accountNumber } (legacy names also accepted)
 */
export const addMyPayout = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller && !user.isEmployer) {
      return next(
        createError(403, "Only workers or employers can manage payout settings.")
      );
    }

    const normalized = normalizePayoutAccountInput(req.body);
    if (normalized.error) {
      return next(createError(400, normalized.error));
    }

    ensurePayoutAccountsMigrated(user);

    if (user.payoutAccounts.length >= MAX_PAYOUT_ACCOUNTS) {
      return next(
        createError(
          400,
          `You can save at most ${MAX_PAYOUT_ACCOUNTS} payout accounts.`
        )
      );
    }

    user.payoutAccounts.push({
      method: normalized.method,
      provider: normalized.provider,
      accountName: normalized.accountName,
      accountNumber: normalized.accountNumber,
      label:
        typeof req.body.label === "string"
          ? req.body.label.trim().slice(0, 60)
          : undefined,
    });
    syncLegacyPayoutFields(user);
    await user.save();

    const created = user.payoutAccounts[user.payoutAccounts.length - 1];
    res.status(201).json({
      message: "Payout account added.",
      account: serializePayoutAccount(created),
      accounts: user.payoutAccounts.map(serializePayoutAccount),
      payoutUpdatedAt: user.payoutUpdatedAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me/payout/:accountId — update one payout account
 */
export const updateMyPayout = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller && !user.isEmployer) {
      return next(
        createError(403, "Only workers or employers can manage payout settings.")
      );
    }

    ensurePayoutAccountsMigrated(user);

    const { accountId } = req.params;
    if (accountId === "legacy") {
      // First save after migration: treat as update of the only migrated row
      if (user.payoutAccounts.length !== 1) {
        return next(
          createError(400, "Legacy payout already migrated. Refresh and try again.")
        );
      }
    }

    const account =
      accountId === "legacy"
        ? user.payoutAccounts[0]
        : user.payoutAccounts.id(accountId);

    if (!account) {
      return next(createError(404, "Payout account not found!"));
    }

    const normalized = normalizePayoutAccountInput({
      method: req.body.method ?? req.body.payoutMethod ?? account.method,
      provider: req.body.provider ?? req.body.payoutProvider ?? account.provider,
      accountName:
        req.body.accountName ??
        req.body.payoutAccountName ??
        account.accountName,
      accountNumber:
        req.body.accountNumber ??
        req.body.payoutAccountNumber ??
        account.accountNumber,
    });
    if (normalized.error) {
      return next(createError(400, normalized.error));
    }

    account.method = normalized.method;
    account.provider = normalized.provider;
    account.accountName = normalized.accountName;
    account.accountNumber = normalized.accountNumber;
    if (typeof req.body.label === "string") {
      account.label = req.body.label.trim().slice(0, 60) || undefined;
    }

    syncLegacyPayoutFields(user);
    await user.save();

    res.status(200).json({
      message: "Payout account updated.",
      account: serializePayoutAccount(account),
      accounts: user.payoutAccounts.map(serializePayoutAccount),
      payoutUpdatedAt: user.payoutUpdatedAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/me/payout/:accountId
 */
export const deleteMyPayout = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller && !user.isEmployer) {
      return next(
        createError(403, "Only workers or employers can manage payout settings.")
      );
    }

    ensurePayoutAccountsMigrated(user);

    const { accountId } = req.params;
    if (accountId === "legacy") {
      if (user.payoutAccounts.length === 1) {
        user.payoutAccounts.splice(0, 1);
      } else {
        return next(
          createError(400, "Legacy payout already migrated. Refresh and try again.")
        );
      }
    } else {
      const account = user.payoutAccounts.id(accountId);
      if (!account) {
        return next(createError(404, "Payout account not found!"));
      }
      account.deleteOne();
    }

    syncLegacyPayoutFields(user);
    await user.save();

    res.status(200).json({
      message: "Payout account removed.",
      accounts: user.payoutAccounts.map(serializePayoutAccount),
      payoutUpdatedAt: user.payoutUpdatedAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me/payout — legacy: add account (or clear all if method=none)
 * Prefer POST /me/payout for new clients.
 */
export const setMyPayout = async (req, res, next) => {
  try {
    if (req.body.payoutMethod === "none" || req.body.method === "none") {
      const user = await User.findById(req.userId);
      if (!user) return next(createError(404, "User not found!"));
      if (!user.isSeller && !user.isEmployer) {
        return next(
          createError(
            403,
            "Only workers or employers can manage payout settings."
          )
        );
      }
      user.payoutAccounts = [];
      syncLegacyPayoutFields(user);
      await user.save();
      return res.status(200).json({
        message: "All payout accounts cleared.",
        accounts: [],
        payoutMethod: "none",
        payoutProvider: null,
        payoutAccountName: null,
        payoutAccountNumber: null,
        payoutUpdatedAt: user.payoutUpdatedAt,
      });
    }

    // Delegate to add
    return addMyPayout(req, res, next);
  } catch (err) {
    next(err);
  }
};

/** GET /api/users/me/earnings — worker earnings from completed orders */
export const getMyEarnings = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("isSeller username");
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller) {
      return next(
        createError(403, "Only workers can view marketplace earnings.")
      );
    }

    const sellerId = String(req.userId);
    const completed = await Order.find({
      sellerId,
      isCompleted: true,
    })
      .select("title price platformFee sellerEarnings status createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(50);

    const balance = await getSellerPayoutBalance(sellerId);

    res.status(200).json({
      totalEarnings: balance.totalEarnings,
      totalGross: balance.totalGross,
      totalPlatformFees: balance.totalPlatformFees,
      completedOrders: balance.completedOrders,
      availableBalance: balance.availableBalance,
      pendingAmount: balance.pendingAmount,
      approvedAmount: balance.approvedAmount,
      paidOut: balance.paidOut,
      minPayoutAmount: balance.minPayoutAmount,
      currency: balance.currency,
      recentOrders: completed,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/workers
 * Discover sellers by service city/region and optional category (via approved gigs).
 */
export const discoverWorkers = async (req, res, next) => {
  try {
    const q = req.query;
    const filter = {
      isSeller: true,
      isBanned: { $ne: true },
    };

    if (q.verified === "true" || q.verified === "1") {
      filter.isVerified = true;
    }

    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100);
    const selectFields =
      "username img desc country address isSeller isVerified verificationStatus serviceCity serviceRegion serviceCountry serviceCoordinates availability availabilityTimezone availabilityNote availabilityUpdatedAt createdAt";

    // Category discovery: sellers who have approved gigs in that trade (+ optional gig location)
    if (q.cat) {
      const catSlug = normalizeCategorySlug(q.cat);
      if (!catSlug) {
        return next(
          createError(400, "Invalid category for worker discovery.")
        );
      }
      const gigFilter = {
        cat: catSlug,
        status: "approved",
      };
      if (q.city) {
        Object.assign(gigFilter, locationTextFilter("location.city", q.city));
      }
      if (q.region) {
        Object.assign(
          gigFilter,
          locationTextFilter("location.region", q.region)
        );
      }
      if (q.country) {
        Object.assign(
          gigFilter,
          locationTextFilter("location.country", q.country)
        );
      }

      const gigs = await Gig.find(gigFilter).select("userId");
      const sellerIds = [...new Set(gigs.map((g) => String(g.userId)))];
      if (sellerIds.length === 0) {
        return res.status(200).json({ workers: [], count: 0 });
      }
      filter._id = { $in: sellerIds };
    } else {
      // Profile service-area discovery
      const cityFilter = locationTextFilter("serviceCity", q.city);
      const regionFilter = locationTextFilter("serviceRegion", q.region);
      const countryFilter = locationTextFilter("serviceCountry", q.country);
      Object.assign(filter, cityFilter, regionFilter, countryFilter);
    }

    const lat = q.lat !== undefined ? Number(q.lat) : NaN;
    const lng = q.lng !== undefined ? Number(q.lng) : NaN;
    const radiusKm =
      q.radiusKm !== undefined
        ? Number(q.radiusKm)
        : q.radius !== undefined
          ? Number(q.radius)
          : NaN;
    const useGeo =
      !q.cat &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Number.isFinite(radiusKm) &&
      radiusKm > 0;

    let workers;
    if (useGeo) {
      workers = await User.find({
        ...filter,
        serviceCoordinates: {
          $near: {
            $geometry: { type: "Point", coordinates: [lng, lat] },
            $maxDistance: radiusKm * 1000,
          },
        },
      })
        .select(selectFields)
        .limit(limit);
    } else {
      workers = await User.find(filter)
        .select(selectFields)
        .sort({ createdAt: -1 })
        .limit(limit);
    }

    const payload = workers.map((w) => {
      const doc = w.toObject ? w.toObject() : w;
      return {
        ...doc,
        availableNow: isAvailableAt(
          doc.availability || [],
          doc.availabilityTimezone || "Africa/Accra"
        ),
      };
    });

    res.status(200).json({
      workers: payload,
      count: payload.length,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/users/me/availability */
export const getMyAvailability = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "isSeller availability availabilityTimezone availabilityNote availabilityUpdatedAt"
    );
    if (!user) return next(createError(404, "User not found!"));

    res.status(200).json({
      isSeller: user.isSeller,
      windows: user.availability || [],
      timezone: user.availabilityTimezone || "Africa/Accra",
      note: user.availabilityNote || null,
      updatedAt: user.availabilityUpdatedAt || null,
      availableNow: user.isSeller
        ? isAvailableAt(
            user.availability || [],
            user.availabilityTimezone || "Africa/Accra"
          )
        : null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me/availability
 * Replace seller weekly schedule.
 * Body: { windows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }], timezone?, note? }
 */
export const setMyAvailability = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller) {
      return next(
        createError(
          403,
          "Only sellers (workers) can set availability. Enable seller mode first."
        )
      );
    }

    let parsed;
    try {
      parsed = parseAvailabilityInput(req.body);
    } catch (err) {
      return next(
        err.status === 400 ? createError(400, err.message) : err
      );
    }

    user.availability = parsed.windows;
    user.availabilityTimezone = parsed.timezone;
    if (parsed.note !== null || req.body.note !== undefined || req.body.availabilityNote !== undefined) {
      user.availabilityNote = parsed.note || undefined;
    }
    user.availabilityUpdatedAt = new Date();
    await user.save();

    res.status(200).json({
      message: "Availability updated.",
      windows: user.availability,
      timezone: user.availabilityTimezone,
      note: user.availabilityNote || null,
      updatedAt: user.availabilityUpdatedAt,
      availableNow: isAvailableAt(
        user.availability,
        user.availabilityTimezone
      ),
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/users/:id/availability — public seller schedule */
export const getUserAvailability = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "username isSeller availability availabilityTimezone availabilityNote availabilityUpdatedAt"
    );
    if (!user) return next(createError(404, "User not found!"));

    if (!user.isSeller) {
      return next(createError(404, "Availability is only published for workers."));
    }

    res.status(200).json({
      userId: user._id,
      username: user.username,
      windows: user.availability || [],
      timezone: user.availabilityTimezone || "Africa/Accra",
      note: user.availabilityNote || null,
      updatedAt: user.availabilityUpdatedAt || null,
      availableNow: isAvailableAt(
        user.availability || [],
        user.availabilityTimezone || "Africa/Accra"
      ),
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/users/me/employer — own employer mode + company profile */
export const getMyEmployer = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "username isSeller isEmployer companyName companyDesc isAdmin"
    );
    if (!user) return next(createError(404, "User not found!"));

    res.status(200).json({
      isEmployer: Boolean(user.isEmployer),
      companyName: user.companyName || null,
      companyDesc: user.companyDesc || null,
      accountModes: accountModes(user),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me/employer
 * Enable/disable employer hiring mode and optional company profile.
 * Does not change isSeller (worker) or buyer purchase ability.
 * Body: { isEmployer?: boolean, companyName?: string, companyDesc?: string }
 */
export const setMyEmployer = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    if (req.body.isEmployer !== undefined) {
      user.isEmployer = Boolean(req.body.isEmployer);
    } else if (!user.isEmployer) {
      // First call without flag → enable employer mode
      user.isEmployer = true;
    }

    if (req.body.companyName !== undefined) {
      if (
        req.body.companyName !== null &&
        typeof req.body.companyName !== "string"
      ) {
        return next(createError(400, "companyName must be a string."));
      }
      const name =
        typeof req.body.companyName === "string"
          ? req.body.companyName.trim().slice(0, 120)
          : "";
      user.companyName = name || undefined;
    }

    if (req.body.companyDesc !== undefined) {
      if (
        req.body.companyDesc !== null &&
        typeof req.body.companyDesc !== "string"
      ) {
        return next(createError(400, "companyDesc must be a string."));
      }
      const desc =
        typeof req.body.companyDesc === "string"
          ? req.body.companyDesc.trim().slice(0, 1000)
          : "";
      user.companyDesc = desc || undefined;
    }

    await user.save();

    const token = signAccessToken(user);
    const { password, ...info } = user._doc;

    res
      .cookie("accessToken", token, getAccessTokenCookieOptions())
      .status(200)
      .json({
        message: user.isEmployer
          ? "Employer mode enabled."
          : "Employer mode disabled.",
        isEmployer: user.isEmployer,
        companyName: user.companyName || null,
        companyDesc: user.companyDesc || null,
        accountModes: accountModes(user),
        user: publicUserView(info, { includeDocuments: true }),
        token,
      });
  } catch (err) {
    next(err);
  }
};
