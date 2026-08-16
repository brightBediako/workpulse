import mongoose from "mongoose";
const { Schema } = mongoose;

const OrderSchema = new Schema(
  {
    /** gig | job | service_request */
    sourceType: {
      type: String,
      enum: ["gig", "job", "service_request"],
      default: "gig",
      index: true,
    },
    gigId: {
      type: String,
      required: false,
      index: true,
    },
    jobId: {
      type: String,
      required: false,
      index: true,
    },
    applicationId: {
      type: String,
      required: false,
      index: true,
    },
    serviceRequestId: {
      type: String,
      required: false,
      index: true,
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
    /** Paystack transaction reference (legacy field name from Stripe era). */
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

OrderSchema.pre("validate", function orderSourceGuard(next) {
  if (!this.gigId && !this.jobId && !this.serviceRequestId) {
    next(new Error("Order must link to a gig, job, or service request."));
  } else {
    next();
  }
});

export default mongoose.model("Order", OrderSchema);
