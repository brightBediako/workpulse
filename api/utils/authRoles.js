import User from "../models/user.model.js";
import { createError } from "../middlewares/globalErrHandler.js";

/** Load current role flags from MongoDB (JWT alone can be stale after role changes). */
export async function loadUserRoles(userId) {
  const user = await User.findById(userId)
    .select("isSeller isEmployer isAdmin isBanned banReason")
    .lean();

  if (!user) {
    throw createError(404, "User not found!");
  }

  if (user.isBanned) {
    const reason = user.banReason
      ? ` Account banned: ${user.banReason}`
      : "";
    throw createError(403, `Login denied.${reason}`);
  }

  return {
    isSeller: Boolean(user.isSeller),
    isEmployer: Boolean(user.isEmployer),
    isAdmin: Boolean(user.isAdmin),
    isSuperAdmin: Boolean(user.isAdmin),
  };
}

export function applyUserRoles(target, roles) {
  target.isSeller = roles.isSeller;
  target.isEmployer = roles.isEmployer;
  target.isAdmin = roles.isAdmin;
  target.isSuperAdmin = roles.isSuperAdmin;
}
