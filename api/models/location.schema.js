import mongoose from "mongoose";
import { DEFAULT_COUNTRY } from "../constants/ghanaLocations.js";
import { isValidGeoPoint } from "../utils/location.js";

const { Schema } = mongoose;

/**
 * Shared marketplace location (city text + optional GeoJSON Point).
 * Coordinates must not be auto-initialized as [] — that breaks 2dsphere.
 */
export const LocationSchema = new Schema(
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
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
  },
  { _id: false, minimize: true }
);

/** Attach to schemas that embed `location` and use a 2dsphere index. */
export const stripInvalidLocationGeo = function stripInvalidLocationGeo(next) {
  if (this.location && !isValidGeoPoint(this.location.coordinates)) {
    this.set("location.coordinates", undefined);
    if (this.location.toObject) {
      this.location.coordinates = undefined;
    } else {
      delete this.location.coordinates;
    }
    this.markModified("location");
  }
  next();
};
