import Order from "../models/order.model.js";
import PayoutRequest from "../models/payoutRequest.model.js";

/** Statuses that reduce available balance (reserved or already paid). */
export const BALANCE_HOLD_STATUSES = ["pending", "approved", "paid"];

export const getMinPayoutAmount = () => {
  const n = Number(process.env.MIN_PAYOUT_AMOUNT);
  return Number.isFinite(n) && n > 0 ? n : 10;
};

/**
 * Lifetime seller earnings from paid orders + payout holds.
 * availableBalance = totalEarnings − (pending + approved + paid requests)
 */
export const getSellerPayoutBalance = async (sellerId) => {
  const id = String(sellerId);

  const [earningsAgg, holdsAgg] = await Promise.all([
    Order.aggregate([
      { $match: { sellerId: id, isCompleted: true } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$sellerEarnings" },
          totalGross: { $sum: "$price" },
          totalPlatformFees: { $sum: "$platformFee" },
          completedOrders: { $sum: 1 },
        },
      },
    ]),
    PayoutRequest.aggregate([
      {
        $match: {
          userId: id,
          status: { $in: BALANCE_HOLD_STATUSES },
        },
      },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const e = earningsAgg[0] || {};
  const totalEarnings = e.totalEarnings || 0;
  const byStatus = Object.fromEntries(
    (holdsAgg || []).map((row) => [row._id, row.total || 0])
  );
  const pendingAmount = byStatus.pending || 0;
  const approvedAmount = byStatus.approved || 0;
  const paidOut = byStatus.paid || 0;
  const reserved = pendingAmount + approvedAmount + paidOut;
  const availableBalance = Math.max(
    0,
    Math.round((totalEarnings - reserved) * 100) / 100
  );

  return {
    totalEarnings,
    totalGross: e.totalGross || 0,
    totalPlatformFees: e.totalPlatformFees || 0,
    completedOrders: e.completedOrders || 0,
    pendingAmount,
    approvedAmount,
    paidOut,
    availableBalance,
    currency: "GHS",
    minPayoutAmount: getMinPayoutAmount(),
  };
};

export const serializePayoutRequest = (doc, { includeUser } = {}) => {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const out = {
    id: String(plain._id),
    userId: plain.userId,
    amount: plain.amount,
    currency: plain.currency || "GHS",
    status: plain.status,
    payoutAccount: plain.payoutAccount,
    note: plain.note || null,
    adminNotes: plain.adminNotes || null,
    rejectionReason: plain.rejectionReason || null,
    processedBy: plain.processedBy || null,
    processedAt: plain.processedAt || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
  if (includeUser && plain.user) {
    out.user = plain.user;
  }
  return out;
};
