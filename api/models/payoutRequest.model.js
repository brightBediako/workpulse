import mongoose from "mongoose";

const { Schema } = mongoose;

const PayoutAccountSnapshotSchema = new Schema(
  {
    accountId: { type: String, required: false },
    method: {
      type: String,
      enum: ["mobile_money", "bank"],
      required: true,
    },
    provider: { type: String, required: true, trim: true, maxlength: 80 },
    accountName: { type: String, required: true, trim: true, maxlength: 120 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 40 },
  },
  { _id: false }
);

const PayoutRequestSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "GHS",
      trim: true,
      maxlength: 8,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid", "cancelled"],
      default: "pending",
      index: true,
    },
    /** Snapshot of destination at request time */
    payoutAccount: {
      type: PayoutAccountSnapshotSchema,
      required: true,
    },
    note: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500,
    },
    adminNotes: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
    },
    rejectionReason: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500,
    },
    processedBy: {
      type: String,
      required: false,
    },
    processedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

PayoutRequestSchema.index({ status: 1, createdAt: -1 });
PayoutRequestSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("PayoutRequest", PayoutRequestSchema);
