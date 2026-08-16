import Order from "../models/order.model.js";
import Gig from "../models/gig.model.js";
import Application from "../models/application.model.js";
import ServiceRequest from "../models/serviceRequest.model.js";
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

  if (order.gigId) {
    await Gig.findByIdAndUpdate(order.gigId, { $inc: { sales: 1 } });
  }

  if (order.applicationId) {
    await Application.findByIdAndUpdate(order.applicationId, {
      status: "paid",
      orderId: String(order._id),
    });
  }

  if (order.serviceRequestId) {
    await ServiceRequest.findByIdAndUpdate(order.serviceRequestId, {
      status: "paid",
      orderId: String(order._id),
    });
  }

  const payLink =
    order.sourceType === "job"
      ? `/jobs`
      : order.sourceType === "service_request"
        ? `/service-requests/${order.serviceRequestId}`
        : `/orders/${order._id}`;

  await createNotification({
    userId: order.sellerId,
    type: "order_paid",
    message: `Payment received for "${order.title}". You can request a payout from Account.`,
    link: "/account",
  });

  if (order.buyerId && order.buyerId !== order.sellerId) {
    await createNotification({
      userId: order.buyerId,
      type: "order_paid",
      message: `Your payment for "${order.title}" was successful.`,
      link: payLink,
    });
  }

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
