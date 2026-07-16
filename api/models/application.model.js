import mongoose from "mongoose";

const { Schema } = mongoose;

const ApplicationSchema = new Schema(
  {
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    employerId: {
      type: String,
      required: true,
      index: true,
    },
    workerId: {
      type: String,
      required: true,
      index: true,
    },
    coverLetter: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
    },
    proposedRate: {
      type: Number,
      required: false,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn"],
      default: "pending",
      index: true,
    },
    reviewedAt: {
      type: Date,
      required: false,
    },
    reviewNote: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

ApplicationSchema.index({ jobId: 1, workerId: 1 }, { unique: true });
ApplicationSchema.index({ workerId: 1, createdAt: -1 });
ApplicationSchema.index({ employerId: 1, status: 1, createdAt: -1 });

export default mongoose.model("Application", ApplicationSchema);
