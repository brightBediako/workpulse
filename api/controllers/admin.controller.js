import User from "../models/user.model.js";
import Gig from "../models/gig.model.js";
import Order from "../models/order.model.js";
import Review from "../models/review.model.js";
import { createError } from "../middlewares/globalErrHandler.js";

// Admin Dashboard - Overview stats
export const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // User stats
    const totalUsers = await User.countDocuments();
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth },
    });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const sellers = await User.countDocuments({ isSeller: true });

    // Gig stats
    const totalGigs = await Gig.countDocuments();
    const pendingGigs = await Gig.countDocuments({ status: "pending" });
    const approvedGigs = await Gig.countDocuments({ status: "approved" });
    const rejectedGigs = await Gig.countDocuments({ status: "rejected" });

    // Order stats
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: "completed" });
    const pendingOrders = await Order.countDocuments({ status: "pending" });
    const disputedOrders = await Order.countDocuments({
      disputeStatus: "open",
    });

    // Revenue stats
    const totalRevenue = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    // Platform fee calculation (assuming 10% platform fee)
    const platformFeeRate = 0.1;
    const totalPlatformFees = totalRevenue[0]?.total * platformFeeRate || 0;
    const monthlyPlatformFees = monthlyRevenue[0]?.total * platformFeeRate || 0;

    // Recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("username email isVerified isBanned createdAt");

    const recentGigs = await Gig.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title status price createdAt")
      .populate("userId", "username");

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title price status createdAt")
      .populate("buyerId", "username")
      .populate("sellerId", "username");

    res.status(200).json({
      overview: {
        totalUsers,
        newUsersThisMonth,
        verifiedUsers,
        bannedUsers,
        sellers,
        totalGigs,
        pendingGigs,
        approvedGigs,
        rejectedGigs,
        totalOrders,
        completedOrders,
        pendingOrders,
        disputedOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        totalPlatformFees,
        monthlyPlatformFees,
      },
      recentActivities: {
        recentUsers,
        recentGigs,
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get platform analytics
export const getAnalytics = async (req, res, next) => {
  try {
    const { period = "30" } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // User growth over time
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]);

    // Revenue over time
    const revenueGrowth = await Order.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          revenue: { $sum: "$price" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]);

    // Top categories
    const topCategories = await Gig.aggregate([
      {
        $match: { status: "approved" },
      },
      {
        $group: {
          _id: "$cat",
          count: { $sum: 1 },
          totalSales: { $sum: "$sales" },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Top sellers
    const topSellers = await User.aggregate([
      {
        $match: { isSeller: true },
      },
      {
        $lookup: {
          from: "gigs",
          localField: "_id",
          foreignField: "userId",
          as: "gigs",
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "sellerId",
          as: "orders",
        },
      },
      {
        $addFields: {
          totalSales: { $sum: "$gigs.sales" },
          totalEarnings: { $sum: "$orders.sellerEarnings" },
          totalOrders: { $size: "$orders" },
        },
      },
      {
        $sort: { totalEarnings: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          username: 1,
          email: 1,
          totalSales: 1,
          totalEarnings: 1,
          totalOrders: 1,
          isVerified: 1,
        },
      },
    ]);

    res.status(200).json({
      period: `${days} days`,
      userGrowth,
      revenueGrowth,
      topCategories,
      topSellers,
    });
  } catch (err) {
    next(err);
  }
};

// User Management
export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, role } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "verified") filter.isVerified = true;
    if (status === "banned") filter.isBanned = true;
    if (status === "pending") filter.verificationStatus = "pending";

    if (role === "seller") filter.isSeller = true;
    if (role === "admin") filter.isAdmin = true;

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(filter);

    res.status(200).json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNext: page < Math.ceil(totalUsers / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return next(createError(404, "User not found!"));

    // Get user's gigs if they're a seller
    let userGigs = [];
    if (user.isSeller) {
      userGigs = await Gig.find({ userId: user._id }).select(
        "title status price createdAt"
      );
    }

    // Get user's orders
    const userOrders = await Order.find({
      $or: [{ buyerId: user._id }, { sellerId: user._id }],
    })
      .select("title price status createdAt")
      .populate("buyerId sellerId", "username");

    res.status(200).json({
      user,
      gigs: userGigs,
      orders: userOrders,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyUser = async (req, res, next) => {
  try {
    const { verificationStatus, adminNotes } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    user.verificationStatus = verificationStatus;
    user.isVerified = verificationStatus === "verified";

    if (adminNotes) {
      user.adminNotes = adminNotes;
    }

    await user.save();

    res.status(200).json({
      message: `User ${verificationStatus} successfully`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const banUser = async (req, res, next) => {
  try {
    const { banReason } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    if (user.isAdmin) {
      return next(createError(403, "Cannot ban admin users!"));
    }

    user.isBanned = true;
    user.banReason = banReason;
    await user.save();

    res.status(200).json({
      message: "User banned successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isBanned: user.isBanned,
        banReason: user.banReason,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const unbanUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    user.isBanned = false;
    user.banReason = null;
    await user.save();

    res.status(200).json({
      message: "User unbanned successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isBanned: user.isBanned,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { username, email, country, phone, desc, isSeller, isAdmin } =
      req.body;

    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    // Prevent non-super admins from changing admin status
    if (isAdmin !== undefined && !req.isSuperAdmin) {
      return next(
        createError(403, "Only super admins can change admin status!")
      );
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (country) updateData.country = country;
    if (phone) updateData.phone = phone;
    if (desc !== undefined) updateData.desc = desc;
    if (isSeller !== undefined) updateData.isSeller = isSeller;
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select("-password");

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    if (user.isAdmin) {
      return next(createError(403, "Cannot delete admin users!"));
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Service Management
export const getAllGigs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, category } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { desc: { $regex: search, $options: "i" } },
      ];
    }

    if (status) filter.status = status;
    if (category) filter.cat = category;

    const gigs = await Gig.find(filter)
      .populate("userId", "username email isVerified")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalGigs = await Gig.countDocuments(filter);

    res.status(200).json({
      gigs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalGigs / limit),
        totalGigs,
        hasNext: page < Math.ceil(totalGigs / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getGigById = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id).populate(
      "userId",
      "username email isVerified isBanned"
    );

    if (!gig) return next(createError(404, "Gig not found!"));

    // Get gig reviews
    const reviews = await Review.find({ gigId: gig._id })
      .populate("userId", "username")
      .sort({ createdAt: -1 });

    // Get gig orders
    const orders = await Order.find({ gigId: gig._id })
      .populate("buyerId sellerId", "username")
      .sort({ createdAt: -1 });

    res.status(200).json({
      gig,
      reviews,
      orders,
    });
  } catch (err) {
    next(err);
  }
};

export const approveGig = async (req, res, next) => {
  try {
    const { adminNotes } = req.body;

    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));

    gig.status = "approved";
    gig.approvedBy = req.userId;
    gig.approvedAt = new Date();

    if (adminNotes) {
      gig.adminNotes = adminNotes;
    }

    await gig.save();

    res.status(200).json({
      message: "Gig approved successfully",
      gig: {
        id: gig._id,
        title: gig.title,
        status: gig.status,
        approvedBy: gig.approvedBy,
        approvedAt: gig.approvedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const rejectGig = async (req, res, next) => {
  try {
    const { rejectionReason, adminNotes } = req.body;

    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));

    gig.status = "rejected";
    gig.rejectionReason = rejectionReason;

    if (adminNotes) {
      gig.adminNotes = adminNotes;
    }

    await gig.save();

    res.status(200).json({
      message: "Gig rejected successfully",
      gig: {
        id: gig._id,
        title: gig.title,
        status: gig.status,
        rejectionReason: gig.rejectionReason,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const suspendGig = async (req, res, next) => {
  try {
    const { suspensionReason, adminNotes } = req.body;

    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));

    gig.status = "suspended";
    gig.rejectionReason = suspensionReason;

    if (adminNotes) {
      gig.adminNotes = adminNotes;
    }

    await gig.save();

    res.status(200).json({
      message: "Gig suspended successfully",
      gig: {
        id: gig._id,
        title: gig.title,
        status: gig.status,
        rejectionReason: gig.rejectionReason,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateGig = async (req, res, next) => {
  try {
    const {
      title,
      desc,
      price,
      cat,
      shortTitle,
      shortDesc,
      deliveryTime,
      revisionNumber,
      features,
    } = req.body;

    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));

    const updateData = {};
    if (title) updateData.title = title;
    if (desc) updateData.desc = desc;
    if (price) updateData.price = price;
    if (cat) updateData.cat = cat;
    if (shortTitle) updateData.shortTitle = shortTitle;
    if (shortDesc) updateData.shortDesc = shortDesc;
    if (deliveryTime) updateData.deliveryTime = deliveryTime;
    if (revisionNumber) updateData.revisionNumber = revisionNumber;
    if (features) updateData.features = features;

    const updatedGig = await Gig.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).populate("userId", "username email");

    res.status(200).json({
      message: "Gig updated successfully",
      gig: updatedGig,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));

    await Gig.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Gig deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Order Management
export const getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, disputeStatus } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (status) filter.status = status;
    if (disputeStatus) filter.disputeStatus = disputeStatus;

    const orders = await Order.find(filter)
      .populate("buyerId sellerId", "username email")
      .populate("gigId", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalOrders = await Order.countDocuments(filter);

    res.status(200).json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNext: page < Math.ceil(totalOrders / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyerId sellerId", "username email phone")
      .populate("gigId", "title desc price");

    if (!order) return next(createError(404, "Order not found!"));

    res.status(200).json({
      order,
    });
  } catch (err) {
    next(err);
  }
};

export const resolveDispute = async (req, res, next) => {
  try {
    const { resolution, refundAmount, adminNotes } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return next(createError(404, "Order not found!"));

    if (order.disputeStatus !== "open") {
      return next(createError(400, "No open dispute for this order!"));
    }

    order.disputeStatus = "resolved";
    order.adminResolution = resolution;
    order.resolvedBy = req.userId;
    order.resolvedAt = new Date();

    // Handle refund if applicable
    if (refundAmount && refundAmount > 0) {
      order.status = "cancelled";
      // Here you would integrate with Stripe to process refund
    }

    if (adminNotes) {
      order.adminNotes = adminNotes;
    }

    await order.save();

    res.status(200).json({
      message: "Dispute resolved successfully",
      order: {
        id: order._id,
        disputeStatus: order.disputeStatus,
        adminResolution: order.adminResolution,
        resolvedBy: order.resolvedBy,
        resolvedAt: order.resolvedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return next(createError(404, "Order not found!"));

    order.status = status;

    if (adminNotes) {
      order.adminNotes = adminNotes;
    }

    await order.save();

    res.status(200).json({
      message: "Order status updated successfully",
      order: {
        id: order._id,
        status: order.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Payment Management
export const getPaymentStats = async (req, res, next) => {
  try {
    const { period = "30" } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total revenue
    const totalRevenue = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    // Platform fees (assuming 10% platform fee)
    const platformFeeRate = 0.1;
    const totalPlatformFees = totalRevenue[0]?.total * platformFeeRate || 0;

    // Seller earnings
    const totalSellerEarnings = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$sellerEarnings" } } },
    ]);

    // Recent transactions
    const recentTransactions = await Order.find({ status: "completed" })
      .populate("buyerId sellerId", "username")
      .populate("gigId", "title")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("price sellerEarnings platformFee createdAt");

    res.status(200).json({
      period: `${days} days`,
      totalRevenue: totalRevenue[0]?.total || 0,
      totalPlatformFees,
      totalSellerEarnings: totalSellerEarnings[0]?.total || 0,
      recentTransactions,
    });
  } catch (err) {
    next(err);
  }
};

export const getEarningsReport = async (req, res, next) => {
  try {
    const { sellerId, startDate, endDate } = req.query;

    let filter = { status: "completed" };

    if (sellerId) filter.sellerId = sellerId;
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const earnings = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$sellerId",
          totalEarnings: { $sum: "$sellerEarnings" },
          totalOrders: { $sum: 1 },
          totalPlatformFees: { $sum: "$platformFee" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "seller",
        },
      },
      {
        $unwind: "$seller",
      },
      {
        $project: {
          sellerId: "$_id",
          sellerName: "$seller.username",
          sellerEmail: "$seller.email",
          totalEarnings: 1,
          totalOrders: 1,
          totalPlatformFees: 1,
        },
      },
      {
        $sort: { totalEarnings: -1 },
      },
    ]);

    res.status(200).json({
      earnings,
      totalSellers: earnings.length,
    });
  } catch (err) {
    next(err);
  }
};

export const processWithdrawal = async (req, res, next) => {
  try {
    const { amount, method, accountDetails } = req.body;

    // This would integrate with payment processors like Stripe Connect
    // For now, we'll just log the withdrawal request

    res.status(200).json({
      message: "Withdrawal request processed",
      withdrawal: {
        id: req.params.id,
        amount,
        method,
        status: "processed",
        processedAt: new Date(),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Reports
export const generateReport = async (req, res, next) => {
  try {
    const { type, startDate, endDate, format = "json" } = req.body;

    let reportData = {};

    switch (type) {
      case "users":
        reportData = await generateUserReport(startDate, endDate);
        break;
      case "gigs":
        reportData = await generateGigReport(startDate, endDate);
        break;
      case "orders":
        reportData = await generateOrderReport(startDate, endDate);
        break;
      case "revenue":
        reportData = await generateRevenueReport(startDate, endDate);
        break;
      default:
        return next(createError(400, "Invalid report type!"));
    }

    res.status(200).json({
      message: "Report generated successfully",
      type,
      period: { startDate, endDate },
      data: reportData,
      generatedAt: new Date(),
    });
  } catch (err) {
    next(err);
  }
};

export const getSystemLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, level } = req.query;
    const skip = (page - 1) * limit;

    // This would typically come from a logging system
    // For now, we'll return a mock response
    const logs = [
      {
        id: 1,
        level: "info",
        message: "User registered successfully",
        timestamp: new Date(),
        userId: "64a1b2c3d4e5f6789012345",
      },
      {
        id: 2,
        level: "warn",
        message: "Failed login attempt",
        timestamp: new Date(),
        userId: "64a1b2c3d4e5f6789012346",
      },
    ];

    res.status(200).json({
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: 1,
        totalLogs: logs.length,
        hasNext: false,
        hasPrev: false,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Helper functions for reports
const generateUserReport = async (startDate, endDate) => {
  const filter = {};
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const users = await User.find(filter).select(
    "username email isVerified isBanned createdAt"
  );
  return { users, total: users.length };
};

const generateGigReport = async (startDate, endDate) => {
  const filter = {};
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const gigs = await Gig.find(filter).populate("userId", "username");
  return { gigs, total: gigs.length };
};

const generateOrderReport = async (startDate, endDate) => {
  const filter = {};
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const orders = await Order.find(filter).populate(
    "buyerId sellerId",
    "username"
  );
  return { orders, total: orders.length };
};

const generateRevenueReport = async (startDate, endDate) => {
  const filter = { status: "completed" };
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const revenue = await Order.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$price" },
        totalPlatformFees: { $sum: "$platformFee" },
        totalSellerEarnings: { $sum: "$sellerEarnings" },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  return (
    revenue[0] || {
      totalRevenue: 0,
      totalPlatformFees: 0,
      totalSellerEarnings: 0,
      orderCount: 0,
    }
  );
};
