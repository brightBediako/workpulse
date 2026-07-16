import { DEFAULT_COUNTRY } from "../constants/ghanaLocations.js";

/**
 * True when value is a usable GeoJSON Point for a 2dsphere index.
 */
export const isValidGeoPoint = (geo) => {
  if (!geo || typeof geo !== "object") return false;
  if (geo.type !== "Point") return false;
  const coords = geo.coordinates;
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    Number.isFinite(Number(coords[0])) &&
    Number.isFinite(Number(coords[1]))
  );
};

/**
 * Drop empty/invalid GeoJSON so MongoDB 2dsphere indexes do not reject the doc.
 * Mutates and returns the location object (or null).
 */
export const sanitizeLocation = (location) => {
  if (!location || typeof location !== "object") return null;

  const cleaned = { ...location };
  if (!isValidGeoPoint(cleaned.coordinates)) {
    delete cleaned.coordinates;
  }

  const hasText = Boolean(
    cleaned.city || cleaned.region || cleaned.area || cleaned.country
  );
  const hasCoords = Boolean(cleaned.coordinates);
  if (!hasText && !hasCoords) return null;

  return cleaned;
};

/**
 * Build a gig/user location object from request body.
 * Accepts either nested `location: { city, region, … }` or flat fields.
 * Only attaches GeoJSON when lat/lng are valid numbers.
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

  // Prefer explicit lat/lng — ignore empty nested GeoJSON from clients
  const rawCoords = src.coordinates;
  const lat =
    src.lat ??
    src.latitude ??
    (rawCoords && !Array.isArray(rawCoords) ? rawCoords.lat : undefined);
  const lng =
    src.lng ??
    src.longitude ??
    (rawCoords && !Array.isArray(rawCoords) ? rawCoords.lng : undefined);

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

  return sanitizeLocation(location);
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
