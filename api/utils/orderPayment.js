import Order from "../models/order.model.js";
import Gig from "../models/gig.model.js";
import { computeOrderFees } from "./orderFees.js";
import { createNotification } from "../services/notificationService.js";

/**
 * Idempotently mark an order paid after Paystack charge success.
 * Shared by client confirm (after verify API) and webhook.
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
 * Find order by Paystack reference (stored in payment_intent) and mark paid if found.
 * @returns {null | { order, alreadyPaid, feePercent }}
 */
export const markOrderPaidByPaymentIntent = async (paymentReference) => {
  if (!paymentReference) return null;
  const order = await Order.findOne({ payment_intent: paymentReference });
  if (!order) return null;
  return markOrderPaid(order);
};
