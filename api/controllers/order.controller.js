import Order from "../models/order.model.js";
import Gig from "../models/gig.model.js";
import User from "../models/user.model.js";
import { createError } from "../middlewares/globalErrHandler.js";
import {
  markOrderPaid,
  markOrderPaidByPaymentIntent,
} from "../utils/orderPayment.js";
import {
  createPaymentReference,
  initializeTransaction,
  isPaystackConfigured,
  verifyTransaction,
  verifyWebhookSignature,
} from "../services/paystackService.js";

const isOrderParty = (order, userId) =>
  String(order.buyerId) === String(userId) ||
  String(order.sellerId) === String(userId);

const clientBaseUrl = () =>
  (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");

export const getOrders = async (req, res, next) => {
  try {
    const filter = req.isSeller
      ? { sellerId: req.userId }
      : { buyerId: req.userId };

    // Paid engagements (isCompleted) plus any still-pending payment for the role
    const orders = await Order.find({
      ...filter,
      $or: [{ isCompleted: true }, { status: "pending" }],
    }).sort({ createdAt: -1 });

    res.status(200).send(orders);
  } catch (err) {
    next(err);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return next(createError(404, "Order not found!"));
    if (!isOrderParty(order, req.userId) && !req.isAdmin) {
      return next(createError(403, "You can only view your own orders!"));
    }
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
};

/**
 * Initialize Paystack checkout for an approved gig.
 * Stores Paystack reference in order.payment_intent (legacy field name).
 */
export const intent = async (req, res, next) => {
  try {
    if (!isPaystackConfigured()) {
      return next(
        createError(
          500,
          "Paystack is not configured. Please set PAYSTACK_SECRET_KEY in environment variables."
        )
      );
    }

    const gig = await Gig.findById(req.params.id);
    if (!gig) {
      return next(createError(404, "Gig not found!"));
    }

    if (gig.status !== "approved") {
      return next(
        createError(400, "You can only order approved service listings!")
      );
    }

    if (String(gig.userId) === String(req.userId)) {
      return next(createError(403, "You cannot order your own gig!"));
    }

    const buyer = await User.findById(req.userId).select("email");
    if (!buyer?.email) {
      return next(
        createError(400, "Your account needs a valid email to pay with Paystack.")
      );
    }

    const reference = createPaymentReference();
    const callbackUrl = `${clientBaseUrl()}/orders/callback`;

    const payment = await initializeTransaction({
      email: buyer.email,
      amountMajor: gig.price,
      reference,
      callbackUrl,
      metadata: {
        gigId: String(gig._id),
        buyerId: String(req.userId),
        sellerId: String(gig.userId),
        custom_fields: [
          {
            display_name: "Gig",
            variable_name: "gig_title",
            value: gig.title,
          },
        ],
      },
    });

    const newOrder = new Order({
      gigId: gig._id,
      img: gig.cover,
      title: gig.title,
      price: gig.price,
      sellerId: gig.userId,
      buyerId: req.userId,
      payment_intent: payment.reference,
      status: "pending",
      isCompleted: false,
      disputeStatus: "none",
    });

    await newOrder.save();

    res.status(200).send({
      authorization_url: payment.authorization_url,
      access_code: payment.access_code,
      reference: payment.reference,
      /** @deprecated Alias for reference — kept for older clients */
      payment_intent: payment.reference,
      orderId: newOrder._id,
    });
  } catch (err) {
    if (err.statusCode) {
      return next(createError(err.statusCode, err.message));
    }
    next(err);
  }
};

/**
 * Mark order paid after Paystack checkout.
 * Verifies transaction status with Paystack before updating (idempotent with webhook).
 * Body: { payment_intent | reference } — both mean the Paystack reference.
 */
export const confirm = async (req, res, next) => {
  try {
    if (!isPaystackConfigured()) {
      return next(
        createError(
          500,
          "Paystack is not configured. Please set PAYSTACK_SECRET_KEY in environment variables."
        )
      );
    }

    const reference =
      req.body.reference || req.body.payment_intent || req.body.trxref;
    if (!reference) {
      return next(
        createError(400, "payment reference is required (reference or payment_intent)!")
      );
    }

    const order = await Order.findOne({ payment_intent: reference });
    if (!order) return next(createError(404, "Order not found!"));

    if (String(order.buyerId) !== String(req.userId) && !req.isAdmin) {
      return next(createError(403, "You can only confirm your own orders!"));
    }

    if (order.isCompleted) {
      return res.status(200).json({
        message: "Order already confirmed.",
        order,
      });
    }

    const transaction = await verifyTransaction(reference);
    if (transaction.status !== "success") {
      return next(
        createError(
          400,
          `Payment not completed yet (Paystack status: ${transaction.status}).`
        )
      );
    }

    const result = await markOrderPaid(order);

    res.status(200).json({
      message: result.alreadyPaid
        ? "Order already confirmed."
        : "Order has been confirmed.",
      order: result.order,
      feePercent: result.feePercent,
    });
  } catch (err) {
    if (err.statusCode) {
      return next(createError(err.statusCode, err.message));
    }
    next(err);
  }
};

/**
 * Paystack webhook — primary paid confirmation path.
 * Requires raw body (mounted before express.json) + PAYSTACK_SECRET_KEY for HMAC.
 */
export const paystackWebhook = async (req, res) => {
  if (!isPaystackConfigured()) {
    return res.status(500).send("Paystack is not configured.");
  }

  const signature = req.headers["x-paystack-signature"];
  if (!verifyWebhookSignature(req.body, signature)) {
    console.error("Paystack webhook signature verification failed");
    return res.status(400).send("Invalid Paystack signature.");
  }

  let event;
  try {
    event =
      typeof req.body === "string" || Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString("utf8"))
        : req.body;
  } catch (err) {
    console.error("Paystack webhook: invalid JSON", err.message);
    return res.status(400).send("Invalid JSON body.");
  }

  try {
    switch (event.event) {
      case "charge.success": {
        const reference = event.data?.reference;
        const result = await markOrderPaidByPaymentIntent(reference);
        if (!result) {
          console.warn(
            `Paystack webhook: no order for reference ${reference}`
          );
        }
        break;
      }
      default:
        // Ignore unrelated events
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Paystack webhook handler error:", err?.message || err);
    res.status(500).json({ message: "Webhook handler failed." });
  }
};

/** @deprecated Use paystackWebhook — kept export name for any external imports */
export const stripeWebhook = paystackWebhook;

/** Buyer or seller marks paid work as finished → status completed */
export const completeOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return next(createError(404, "Order not found!"));

    if (!isOrderParty(order, req.userId)) {
      return next(createError(403, "You can only complete your own orders!"));
    }

    if (!order.isCompleted) {
      return next(createError(400, "Order must be paid before it can be completed!"));
    }

    if (order.status === "disputed" || order.disputeStatus === "open") {
      return next(
        createError(400, "Cannot complete an order with an open dispute!")
      );
    }

    if (order.status === "cancelled") {
      return next(createError(400, "Cancelled orders cannot be completed!"));
    }

    if (order.status === "completed") {
      return res.status(200).json({
        message: "Order already completed.",
        order,
      });
    }

    order.status = "completed";
    await order.save();

    res.status(200).json({
      message: "Order marked as completed.",
      order,
    });
  } catch (err) {
    next(err);
  }
};

/** Buyer or seller opens a dispute (pairs with admin resolveDispute) */
export const openDispute = async (req, res, next) => {
  try {
    const { reason, description } = req.body;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return next(createError(400, "Dispute reason is required!"));
    }

    const order = await Order.findById(req.params.id);
    if (!order) return next(createError(404, "Order not found!"));

    if (!isOrderParty(order, req.userId)) {
      return next(createError(403, "You can only dispute your own orders!"));
    }

    if (!order.isCompleted) {
      return next(createError(400, "Only paid orders can be disputed!"));
    }

    if (order.disputeStatus === "open") {
      return next(createError(400, "A dispute is already open for this order!"));
    }

    if (order.disputeStatus === "resolved" || order.disputeStatus === "closed") {
      return next(
        createError(400, "This order's dispute was already handled!")
      );
    }

    order.disputeReason = reason.trim();
    order.disputeDescription =
      typeof description === "string" ? description.trim() : "";
    order.disputeStatus = "open";
    order.status = "disputed";
    await order.save();

    res.status(200).json({
      message: "Dispute opened successfully.",
      order,
    });
  } catch (err) {
    next(err);
  }
};
