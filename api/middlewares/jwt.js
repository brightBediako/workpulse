import jwt from "jsonwebtoken";
import { createError } from "../middlewares/globalErrHandler.js";

/**
 * Resolve JWT from httpOnly cookie `accessToken` or `Authorization: Bearer <token>`.
 * Cookie is preferred when both are present.
 */
const resolveAccessToken = (req) => {
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    return token || null;
  }

  return null;
};

export const verifyToken = (req, res, next) => {
  const token = resolveAccessToken(req);
  if (!token) return next(createError(401, "You are not authenticated!"));

  jwt.verify(token, process.env.JWT_KEY, (err, payload) => {
    if (err) return next(createError(403, "Token is not valid!"));
    req.userId = payload.id;
    req.isSeller = payload.isSeller;
    req.isEmployer = Boolean(payload.isEmployer);
    req.isAdmin = payload.isAdmin;
    req.isSuperAdmin = payload.isSuperAdmin;
    next();
  });
};
