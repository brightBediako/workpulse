import mongoose from "mongoose";
import { GIG_CATEGORY_SLUGS } from "../constants/gigCategories.js";
import { DEFAULT_COUNTRY } from "../constants/ghanaLocations.js";

const { Schema } = mongoose;

const LocationSchema = new Schema(
  {
    city: { type: String, required: false, trim: true, index: true },
    region: { type: String, required: false, trim: true, index: true },
    area: { type: String, required: false, trim: true },
    country: {
      type: String,
      required: false,
      trim: true,
      default: DEFAULT_COUNTRY,
      index: true,
    },
    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        required: false,
      },
      coordinates: {
        type: [Number],
        required: false,
      },
    },
  },
  { _id: false }
);

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
      enum: ["open", "accepted", "rejected", "cancelled", "completed"],
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
  },
  { timestamps: true }
);

ServiceRequestSchema.index({ "location.coordinates": "2dsphere" });
ServiceRequestSchema.index({ status: 1, cat: 1, createdAt: -1 });
ServiceRequestSchema.index({ customerId: 1, createdAt: -1 });
ServiceRequestSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

export default mongoose.model("ServiceRequest", ServiceRequestSchema);
