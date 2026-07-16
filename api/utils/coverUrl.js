import { createError } from "../middlewares/globalErrHandler.js";

/**
 * Accept http(s) URLs or local /uploads/… paths.
 * @param {unknown} value
 * @param {{ required?: boolean }} [opts]
 * @returns {string|undefined}
 */
export function normalizeCoverUrl(value, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw createError(400, "cover image is required.");
    return undefined;
  }
  if (typeof value !== "string") {
    throw createError(400, "cover must be a string URL.");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) throw createError(400, "cover image is required.");
    return undefined;
  }
  if (trimmed.startsWith("/uploads/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch {
    // fall through
  }
  throw createError(
    400,
    "cover must be an http(s) URL or an uploaded /uploads/… path."
  );
}
