import express from "express";
import { verifyToken } from "../middlewares/jwt.js";
import { verifyAdmin, verifySuperAdmin } from "../middlewares/adminAuth.js";
import {
  // Dashboard
  getDashboardStats,
  getAnalytics,

  // User Management
  getAllUsers,
  getUserById,
  verifyUser,
  banUser,
  unbanUser,
  updateUser,
  deleteUser,

  // Service Management
  getAllGigs,
  getGigById,
  approveGig,
  rejectGig,
  suspendGig,
  updateGig,
  deleteGig,

  // Order Management
  getAllOrders,
  getOrderById,
  resolveDispute,
  updateOrderStatus,

  // Payment Management
  getPaymentStats,
  getEarningsReport,
  processWithdrawal,

  // Reports
  generateReport,
  getSystemLogs,
} from "../controllers/admin.controller.js";

const router = express.Router();

// Apply admin authentication to all routes
router.use(verifyToken);
router.use(verifyAdmin);

// Dashboard Routes
router.get("/dashboard", getDashboardStats);
router.get("/analytics", getAnalytics);

// User Management Routes
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id/verify", verifyUser);
router.put("/users/:id/ban", banUser);
router.put("/users/:id/unban", unbanUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Service Management Routes
router.get("/gigs", getAllGigs);
router.get("/gigs/:id", getGigById);
router.put("/gigs/:id/approve", approveGig);
router.put("/gigs/:id/reject", rejectGig);
router.put("/gigs/:id/suspend", suspendGig);
router.put("/gigs/:id", updateGig);
router.delete("/gigs/:id", deleteGig);

// Order Management Routes
router.get("/orders", getAllOrders);
router.get("/orders/:id", getOrderById);
router.put("/orders/:id/resolve-dispute", resolveDispute);
router.put("/orders/:id/status", updateOrderStatus);

// Payment Management Routes
router.get("/payments/stats", getPaymentStats);
router.get("/payments/earnings", getEarningsReport);
router.post("/payments/withdrawals/:id/process", processWithdrawal);

// Reports Routes
router.post("/reports/generate", generateReport);
router.get("/logs", getSystemLogs);

export default router;
