import {
  GHANA_CITIES,
  GHANA_REGIONS,
  DEFAULT_COUNTRY,
} from "../constants/ghanaLocations.js";

/** GET /api/locations — curated Ghana cities/regions for filters */
export const getLocations = async (req, res, next) => {
  try {
    res.status(200).json({
      country: DEFAULT_COUNTRY,
      regions: GHANA_REGIONS,
      cities: GHANA_CITIES,
    });
  } catch (err) {
    next(err);
  }
};
