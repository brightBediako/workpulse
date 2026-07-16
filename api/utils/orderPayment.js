import Order from "../models/order.model.js";
import Gig from "../models/gig.model.js";
import { computeOrderFees } from "./orderFees.js";
import { createNotification } from "../services/notificationService.js";

/**
 * Idempotently mark an order paid after Stripe PaymentIntent success.
 * Shared by client confirm (after API status check) and webhook.
 *
 * @returns {{ order, alreadyPaid: boolean, feePercent: number }}
 */
export const markOrderPaid = async (order) => {
  if (order.isCompleted) {
    return {
      order,
      alreadyPaid: true,
      feePercent: computeOrderFees(order.price).feePercent,
    };
  }

  const { platformFee, sellerEarnings, feePercent } = computeOrderFees(
    order.price
  );

  order.isCompleted = true;
  order.status = "in_progress";
  order.platformFee = platformFee;
  order.sellerEarnings = sellerEarnings;
  await order.save();

  await Gig.findByIdAndUpdate(order.gigId, { $inc: { sales: 1 } });

  await createNotification({
    userId: order.sellerId,
    type: "order_paid",
    message: `New paid order for "${order.title}".`,
    link: `/orders/${order._id}`,
  });

  return { order, alreadyPaid: false, feePercent };
};

/**
 * Find order by Stripe PaymentIntent id and mark paid if found.
 * @returns {null | { order, alreadyPaid, feePercent }}
 */
export const markOrderPaidByPaymentIntent = async (paymentIntentId) => {
  if (!paymentIntentId) return null;
  const order = await Order.findOne({ payment_intent: paymentIntentId });
  if (!order) return null;
  return markOrderPaid(order);
};
