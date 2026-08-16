import express from "express";
import { getSmtpStatus } from "../services/emailService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import authRoute from "../routes/auth.route.js";
import userRoute from "../routes/user.route.js";
import gigRoute from "../routes/gig.route.js";
import orderRoute from "../routes/order.route.js";
import { paystackWebhook } from "../controllers/order.controller.js";
import conversationRoute from "../routes/conversation.route.js";
import messageRoute from "../routes/message.route.js";
import reviewRoute from "../routes/review.route.js";
import adminRoute from "../routes/admin.route.js";
import notificationRoute from "../routes/notification.route.js";
import categoryRoute from "../routes/category.route.js";
import locationRoute from "../routes/location.route.js";
import jobRoute from "../routes/job.route.js";
import serviceRequestRoute from "../routes/serviceRequest.route.js";
import uploadRoute from "../routes/upload.route.js";

import cors from "cors";
import cookieParser from "cookie-parser";
import { expressCorsOptions } from "../config/corsOrigins.js";

import dbConnect from "../config/dbConnect.js";
import { globalErrhandler, notFound } from "../middlewares/globalErrHandler.js";
import { ensureUploadDirs } from "../utils/uploads.js";

dotenv.config();
//db connect
dbConnect();
ensureUploadDirs();
const app = express();
app.set("trust proxy", 1);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, "..", "uploads");

app.use(cors(expressCorsOptions));

// Paystack webhook needs the raw body for HMAC signature verification (before JSON parser)
app.post(
  "/api/orders/webhook",
  express.raw({ type: "application/json" }),
  paystackWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadsRoot));

// Health checks (avoid wildcard routes for Express 5 compatibility)
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/healthz", (req, res) => {
  const mail = getSmtpStatus();
  res.status(200).json({
    status: "ok",
    email: {
      mode: mail.mode,
      configured: mail.configured,
      ...(mail.configured
        ? { host: mail.host, port: mail.port, from: mail.from }
        : {}),
    },
  });
});

// custom routes
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/gigs", gigRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/locations", locationRoute);
app.use("/api/jobs", jobRoute);
app.use("/api/service-requests", serviceRequestRoute);
app.use("/api/uploads", uploadRoute);
app.use("/api/orders", orderRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/messages", messageRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/admin", adminRoute);
app.use("/api/notifications", notificationRoute);

// error handler and not found middleware
app.use(notFound);
app.use(globalErrhandler);

export default app;
