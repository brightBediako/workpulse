import mongoose from "mongoose";
import { GIG_CATEGORY_SLUGS } from "../constants/gigCategories.js";
import {
  LocationSchema,
  stripInvalidLocationGeo,
} from "./location.schema.js";

const { Schema } = mongoose;

const JobSchema = new Schema(
  {
    employerId: {
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
    budgetMin: {
      type: Number,
      required: false,
      min: 0,
    },
    budgetMax: {
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
    employmentType: {
      type: String,
      enum: ["one_time", "short_term", "contract", "full_time"],
      default: "one_time",
    },
    positions: {
      type: Number,
      default: 1,
      min: 1,
      max: 50,
    },
    status: {
      type: String,
      enum: ["open", "closed", "filled", "cancelled"],
      default: "open",
      index: true,
    },
    applicationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    acceptedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

JobSchema.pre("validate", stripInvalidLocationGeo);
JobSchema.index({ "location.coordinates": "2dsphere" });
JobSchema.index({ status: 1, cat: 1, createdAt: -1 });
JobSchema.index({ employerId: 1, createdAt: -1 });

export default mongoose.model("Job", JobSchema);
