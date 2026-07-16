import mongoose from "mongoose";
const { Schema, model } = mongoose;

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "welcome",
        "order_paid",
        "gig_approved",
        "gig_rejected",
        "new_message",
        "verification",
        "job_application",
        "application_accepted",
        "application_rejected",
        "service_request",
        "request_accepted",
        "request_rejected",
        "general",
      ],
      default: "general",
    },
    link: {
      type: String,
      required: false,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default model("Notification", notificationSchema);
