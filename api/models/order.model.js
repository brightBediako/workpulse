import mongoose from "mongoose";
const { Schema } = mongoose;

const OrderSchema = new Schema(
  {
    gigId: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      required: false,
    },
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    sellerId: {
      type: String,
      required: true,
    },
    buyerId: {
      type: String,
      required: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    payment_intent: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled", "disputed"],
      default: "pending",
    },
    disputeReason: {
      type: String,
      required: false,
    },
    disputeDescription: {
      type: String,
      required: false,
    },
    disputeStatus: {
      type: String,
      enum: ["none", "open", "resolved", "closed"],
      default: "none",
    },
    adminResolution: {
      type: String,
      required: false,
    },
    resolvedBy: {
      type: String,
      required: false,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    sellerEarnings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Order", OrderSchema);
