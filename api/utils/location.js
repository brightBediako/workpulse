import { DEFAULT_COUNTRY } from "../constants/ghanaLocations.js";

/**
 * Build a gig/user location object from request body.
 * Accepts either nested `location: { city, region, … }` or flat fields.
 */
export const parseLocationInput = (body = {}) => {
  const src =
    body.location && typeof body.location === "object" ? body.location : body;

  const city =
    typeof src.city === "string" ? src.city.trim() : undefined;
  const region =
    typeof src.region === "string" ? src.region.trim() : undefined;
  const area =
    typeof src.area === "string" ? src.area.trim() : undefined;
  const country =
    typeof src.country === "string" && src.country.trim()
      ? src.country.trim()
      : DEFAULT_COUNTRY;

  const lat = src.lat ?? src.latitude ?? src.coordinates?.lat;
  const lng = src.lng ?? src.longitude ?? src.coordinates?.lng;

  const hasText = Boolean(city || region || area);
  const hasCoords =
    lat !== undefined &&
    lat !== null &&
    lng !== undefined &&
    lng !== null &&
    lat !== "" &&
    lng !== "";

  if (!hasText && !hasCoords) {
    return null;
  }

  const location = {
    country,
    ...(city && { city }),
    ...(region && { region }),
    ...(area && { area }),
  };

  if (hasCoords) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      const err = new Error("Invalid latitude/longitude for location.");
      err.status = 400;
      throw err;
    }
    location.coordinates = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
  }

  return location;
};

export const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive exact-ish match for city/region filters */
export const locationTextFilter = (field, value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return {
    [field]: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" },
  };
};
