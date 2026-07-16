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

const GigSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    desc: {
      type: String,
      required: true,
    },
    totalStars: {
      type: Number,
      default: 0,
    },
    starNumber: {
      type: Number,
      default: 0,
    },
    cat: {
      type: String,
      required: true,
      enum: GIG_CATEGORY_SLUGS,
    },
    price: {
      type: Number,
      required: true,
    },
    cover: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      required: false,
    },
    shortTitle: {
      type: String,
      required: true,
    },
    shortDesc: {
      type: String,
      required: true,
    },
    deliveryTime: {
      type: Number,
      required: true,
    },
    revisionNumber: {
      type: Number,
      required: true,
    },
    features: {
      type: [String],
      required: false,
    },
    sales: {
      type: Number,
      default: 0,
    },
    location: {
      type: LocationSchema,
      required: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    adminNotes: {
      type: String,
      required: false,
    },
    approvedBy: {
      type: String,
      required: false,
    },
    approvedAt: {
      type: Date,
      required: false,
    },
    rejectionReason: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

GigSchema.index({ "location.coordinates": "2dsphere" });
GigSchema.index({ "location.city": 1, cat: 1, status: 1 });

export default mongoose.model("Gig", GigSchema);
