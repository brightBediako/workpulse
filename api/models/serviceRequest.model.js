import mongoose from "mongoose";
import { GIG_CATEGORY_SLUGS } from "../constants/gigCategories.js";
import {
  LocationSchema,
  stripInvalidLocationGeo,
} from "./location.schema.js";

const { Schema } = mongoose;

/**
 * Customer demand-side request (alongside seller gigs).
 * Optional sellerId/gigId = directed to one worker; otherwise open board.
 */
const ServiceRequestSchema = new Schema(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    cat: {
      type: String,
      required: true,
      enum: GIG_CATEGORY_SLUGS,
      index: true,
    },
    location: {
      type: LocationSchema,
      required: false,
    },
    budget: {
      type: Number,
      required: false,
      min: 0,
    },
    currency: {
      type: String,
      default: "GHS",
      trim: true,
      maxlength: 8,
    },
    preferredDate: {
      type: Date,
      required: false,
    },
    /** Directed to a specific worker (optional) */
    sellerId: {
      type: String,
      required: false,
      index: true,
    },
    /** Optional related gig listing */
    gigId: {
      type: String,
      required: false,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "open",
        "accepted",
        "rejected",
        "cancelled",
        "work_submitted",
        "work_approved",
        "paid",
        "completed",
      ],
      default: "open",
      index: true,
    },
    acceptedBy: {
      type: String,
      required: false,
      index: true,
    },
    acceptedAt: {
      type: Date,
      required: false,
    },
    rejectedAt: {
      type: Date,
      required: false,
    },
    responseNote: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500,
    },
    workSubmittedAt: { type: Date, required: false },
    workNote: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
    },
    workApprovedAt: { type: Date, required: false },
    agreedAmount: { type: Number, required: false, min: 0 },
    orderId: { type: String, required: false, index: true },
  },
  { timestamps: true }
);

ServiceRequestSchema.pre("validate", stripInvalidLocationGeo);
ServiceRequestSchema.index({ "location.coordinates": "2dsphere" });
ServiceRequestSchema.index({ status: 1, cat: 1, createdAt: -1 });
ServiceRequestSchema.index({ customerId: 1, createdAt: -1 });
ServiceRequestSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

export default mongoose.model("ServiceRequest", ServiceRequestSchema);
