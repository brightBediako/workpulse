import Order from "../models/order.model.js";
import Gig from "../models/gig.model.js";
import Stripe from "stripe";
import { createError } from "../middlewares/globalErrHandler.js";
import {
  markOrderPaid,
  markOrderPaidByPaymentIntent,
} from "../utils/orderPayment.js";

// Initialize Stripe only if API key is provided
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const isOrderParty = (order, userId) =>
  String(order.buyerId) === String(userId) ||
  String(order.sellerId) === String(userId);

export const getOrders = async (req, res, next) => {
  try {
    const filter = req.isSeller
      ? { sellerId: req.userId }
      : { buyerId: req.userId };

    // Paid engagements (isCompleted) plus any still-pending payment intents for the role
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

export const intent = async (req, res, next) => {
  try {
    if (!stripe) {
      return next(
        createError(
          500,
          "Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables."
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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(gig.price) * 100),
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        gigId: String(gig._id),
        buyerId: String(req.userId),
        sellerId: String(gig.userId),
      },
    });

    const newOrder = new Order({
      gigId: gig._id,
      img: gig.cover,
      title: gig.title,
      price: gig.price,
      sellerId: gig.userId,
      buyerId: req.userId,
      payment_intent: paymentIntent.id,
      status: "pending",
      isCompleted: false,
      disputeStatus: "none",
    });

    await newOrder.save();

    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
      orderId: newOrder._id,
      payment_intent: paymentIntent.id,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark order paid after client-side Stripe confirmation.
 * Verifies PaymentIntent status with Stripe before updating (idempotent with webhook).
 */
export const confirm = async (req, res, next) => {
  try {
    if (!stripe) {
      return next(
        createError(
          500,
          "Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables."
        )
      );
    }

    const paymentIntentId = req.body.payment_intent;
    if (!paymentIntentId) {
      return next(createError(400, "payment_intent is required!"));
    }

    const order = await Order.findOne({ payment_intent: paymentIntentId });
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

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return next(
        createError(
          400,
          `Payment not completed yet (Stripe status: ${paymentIntent.status}).`
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
    next(err);
  }
};

/**
 * Stripe webhook — primary paid confirmation path.
 * Requires raw body (mounted before express.json) + STRIPE_WEBHOOK_SECRET.
 */
export const stripeWebhook = async (req, res) => {
  if (!stripe) {
    return res.status(500).send("Stripe is not configured.");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).send("Webhook secret not configured.");
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing stripe-signature header.");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const result = await markOrderPaidByPaymentIntent(paymentIntent.id);
        if (!result) {
          console.warn(
            `Stripe webhook: no order for payment_intent ${paymentIntent.id}`
          );
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.warn(
          `Stripe payment failed for ${paymentIntent.id}:`,
          paymentIntent.last_payment_error?.message || "unknown"
        );
        break;
      }
      default:
        // Ignore unrelated events
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handler error:", err?.message || err);
    res.status(500).json({ message: "Webhook handler failed." });
  }
};

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
