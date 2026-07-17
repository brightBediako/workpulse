import User from "../models/user.model.js";
import PayoutRequest from "../models/payoutRequest.model.js";
import { createError } from "../middlewares/globalErrHandler.js";
import { createNotification } from "../services/notificationService.js";
import {
  resolvePayoutAccounts,
  serializePayoutAccount,
} from "../utils/payoutValidation.js";
import {
  getMinPayoutAmount,
  getSellerPayoutBalance,
  serializePayoutRequest,
} from "../utils/payoutBalance.js";

const notifyAdmins = async (message, link) => {
  try {
    const admins = await User.find({ isAdmin: true }).select("_id").limit(50);
    await Promise.all(
      admins.map((a) =>
        createNotification({
          userId: a._id,
          type: "payout_request",
          message,
          link,
        })
      )
    );
  } catch (err) {
    console.error("notifyAdmins failed:", err?.message || err);
  }
};

const snapshotFromUserAccount = (user, accountId) => {
  const accounts = resolvePayoutAccounts(user);
  if (!accounts.length) return null;

  let account =
    accountId && accountId !== "legacy"
      ? accounts.find((a) => String(a._id) === String(accountId))
      : null;

  if (!account && accountId === "legacy" && accounts.length === 1) {
    account = accounts[0];
  }
  if (!account && !accountId) {
    account = accounts[0];
  }
  if (!account) return null;

  const serialized =
    account._id === "legacy"
      ? {
          id: "legacy",
          method: account.method,
          provider: account.provider,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
        }
      : serializePayoutAccount(account);

  return {
    accountId: serialized.id,
    method: serialized.method,
    provider: serialized.provider,
    accountName: serialized.accountName,
    accountNumber: serialized.accountNumber,
  };
};

/** GET /api/users/me/payout-requests */
export const listMyPayoutRequests = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("isSeller");
    if (!user) return next(createError(404, "User not found!"));
    if (!user.isSeller) {
      return next(createError(403, "Only workers can request payouts."));
    }

    const requests = await PayoutRequest.find({ userId: String(req.userId) })
      .sort({ createdAt: -1 })
      .limit(50);

    const balance = await getSellerPayoutBalance(req.userId);

    res.status(200).json({
      requests: requests.map((r) => serializePayoutRequest(r)),
      balance,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/payout-requests
 * Body: { amount, payoutAccountId?, note? }
 */
export const createMyPayoutRequest = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));
    if (!user.isSeller) {
      return next(createError(403, "Only workers can request payouts."));
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return next(createError(400, "amount must be a positive number."));
    }

    const rounded = Math.round(amount * 100) / 100;
    const minAmount = getMinPayoutAmount();
    if (rounded < minAmount) {
      return next(
        createError(400, `Minimum payout amount is ${minAmount} GHS.`)
      );
    }

    const snapshot = snapshotFromUserAccount(
      user,
      req.body.payoutAccountId || req.body.accountId
    );
    if (!snapshot) {
      return next(
        createError(
          400,
          "Add a MoMo or bank payout account before requesting a payout."
        )
      );
    }

    const balance = await getSellerPayoutBalance(req.userId);
    if (rounded > balance.availableBalance) {
      return next(
        createError(
          400,
          `Insufficient available balance. You can request up to ${balance.availableBalance} GHS.`
        )
      );
    }

    const openPending = await PayoutRequest.countDocuments({
      userId: String(req.userId),
      status: "pending",
    });
    if (openPending >= 5) {
      return next(
        createError(
          400,
          "You already have too many pending payout requests. Wait for admin review."
        )
      );
    }

    const note =
      typeof req.body.note === "string" ? req.body.note.trim().slice(0, 500) : "";

    const doc = await PayoutRequest.create({
      userId: String(req.userId),
      amount: rounded,
      currency: "GHS",
      status: "pending",
      payoutAccount: snapshot,
      note: note || undefined,
    });

    await notifyAdmins(
      `${user.username || "A worker"} requested a payout of GHS ${rounded.toFixed(2)}.`,
      "/admin/payouts"
    );

    res.status(201).json({
      message: "Payout request submitted for admin review.",
      request: serializePayoutRequest(doc),
      balance: await getSellerPayoutBalance(req.userId),
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/users/me/payout-requests/:id/cancel */
export const cancelMyPayoutRequest = async (req, res, next) => {
  try {
    const doc = await PayoutRequest.findById(req.params.id);
    if (!doc) return next(createError(404, "Payout request not found!"));
    if (String(doc.userId) !== String(req.userId)) {
      return next(createError(403, "You can only cancel your own requests."));
    }
    if (doc.status !== "pending") {
      return next(
        createError(400, "Only pending payout requests can be cancelled.")
      );
    }

    doc.status = "cancelled";
    doc.processedAt = new Date();
    await doc.save();

    res.status(200).json({
      message: "Payout request cancelled.",
      request: serializePayoutRequest(doc),
      balance: await getSellerPayoutBalance(req.userId),
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/admin/payouts */
export const listAdminPayouts = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.userId = String(req.query.userId);

    const [total, rows] = await Promise.all([
      PayoutRequest.countDocuments(filter),
      PayoutRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = await User.find({ _id: { $in: userIds } }).select(
      "username email phone isSeller isVerified"
    );
    const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));

    const requests = rows.map((r) => {
      const serialized = serializePayoutRequest(r);
      const u = byId[String(r.userId)];
      if (u) {
        serialized.user = {
          _id: String(u._id),
          username: u.username,
          email: u.email,
          phone: u.phone,
          isVerified: u.isVerified,
        };
      }
      return serialized;
    });

    const pendingCount = await PayoutRequest.countDocuments({
      status: "pending",
    });

    res.status(200).json({
      requests,
      pendingCount,
      pagination: {
        currentPage: page,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        totalRequests: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

const loadAdminRequest = async (id) => {
  const doc = await PayoutRequest.findById(id);
  return doc;
};

/** PUT /api/admin/payouts/:id/approve */
export const approvePayout = async (req, res, next) => {
  try {
    const doc = await loadAdminRequest(req.params.id);
    if (!doc) return next(createError(404, "Payout request not found!"));
    if (doc.status !== "pending") {
      return next(createError(400, "Only pending requests can be approved."));
    }

    doc.status = "approved";
    doc.processedBy = String(req.userId);
    doc.processedAt = new Date();
    if (typeof req.body.adminNotes === "string") {
      doc.adminNotes = req.body.adminNotes.trim().slice(0, 1000);
    }
    await doc.save();

    await createNotification({
      userId: doc.userId,
      type: "payout_approved",
      message: `Your payout request of GHS ${Number(doc.amount).toFixed(2)} was approved.`,
      link: "/account",
    });

    res.status(200).json({
      message: "Payout request approved.",
      request: serializePayoutRequest(doc),
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/admin/payouts/:id/reject */
export const rejectPayout = async (req, res, next) => {
  try {
    const doc = await loadAdminRequest(req.params.id);
    if (!doc) return next(createError(404, "Payout request not found!"));
    if (doc.status !== "pending" && doc.status !== "approved") {
      return next(
        createError(400, "Only pending or approved requests can be rejected.")
      );
    }

    const reason =
      typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      return next(createError(400, "Rejection reason is required."));
    }

    doc.status = "rejected";
    doc.rejectionReason = reason.slice(0, 500);
    doc.processedBy = String(req.userId);
    doc.processedAt = new Date();
    if (typeof req.body.adminNotes === "string") {
      doc.adminNotes = req.body.adminNotes.trim().slice(0, 1000);
    }
    await doc.save();

    await createNotification({
      userId: doc.userId,
      type: "payout_rejected",
      message: `Your payout request of GHS ${Number(doc.amount).toFixed(2)} was rejected: ${reason}`,
      link: "/account",
    });

    res.status(200).json({
      message: "Payout request rejected.",
      request: serializePayoutRequest(doc),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/payouts/:id/paid
 * Mark as paid after manual MoMo/bank transfer.
 */
export const markPayoutPaid = async (req, res, next) => {
  try {
    const doc = await loadAdminRequest(req.params.id);
    if (!doc) return next(createError(404, "Payout request not found!"));
    if (doc.status !== "pending" && doc.status !== "approved") {
      return next(
        createError(400, "Only pending or approved requests can be marked paid.")
      );
    }

    doc.status = "paid";
    doc.processedBy = String(req.userId);
    doc.processedAt = new Date();
    if (typeof req.body.adminNotes === "string") {
      doc.adminNotes = req.body.adminNotes.trim().slice(0, 1000);
    }
    await doc.save();

    await createNotification({
      userId: doc.userId,
      type: "payout_paid",
      message: `Your payout of GHS ${Number(doc.amount).toFixed(2)} has been sent.`,
      link: "/account",
    });

    res.status(200).json({
      message: "Payout marked as paid.",
      request: serializePayoutRequest(doc),
    });
  } catch (err) {
    next(err);
  }
};
