import { createError } from "./globalErrHandler.js";

export const verifyAdmin = (req, res, next) => {
  // Check if user is authenticated
  if (!req.userId) {
    return next(createError(401, "You are not authenticated!"));
  }

  // Check if user is admin
  if (!req.isAdmin) {
    return next(createError(403, "Access denied. Admin privileges required!"));
  }

  next();
};

export const verifyAdminOrSeller = (req, res, next) => {
  // Check if user is authenticated
  if (!req.userId) {
    return next(createError(401, "You are not authenticated!"));
  }

  // Check if user is admin or seller
  if (!req.isAdmin && !req.isSeller) {
    return next(
      createError(403, "Access denied. Admin or seller privileges required!")
    );
  }

  next();
};

export const verifySuperAdmin = (req, res, next) => {
  // Check if user is authenticated
  if (!req.userId) {
    return next(createError(401, "You are not authenticated!"));
  }

  // Check if user is admin
  if (!req.isAdmin) {
    return next(createError(403, "Access denied. Admin privileges required!"));
  }

  // Additional check for super admin (you can add more specific logic here)
  // For now, we'll consider all admins as super admins
  next();
};
