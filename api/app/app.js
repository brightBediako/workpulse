import express from "express";
import dotenv from "dotenv";

import authRoute from "../routes/auth.route.js";
import userRoute from "../routes/user.route.js";
import gigRoute from "../routes/gig.route.js";
import orderRoute from "../routes/order.route.js";
import conversationRoute from "../routes/conversation.route.js";
import messageRoute from "../routes/message.route.js";
import reviewRoute from "../routes/review.route.js";
import adminRoute from "../routes/admin.route.js";

import cors from "cors";
import cookieParser from "cookie-parser";

import dbConnect from "../config/dbConnect.js";
import { globalErrhandler, notFound } from "../middlewares/globalErrHandler.js";

dotenv.config();
//db connect
dbConnect();
const app = express();

//cors configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "https://service-two-sand.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ];

    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // Check for common deployment patterns
    const allowedPatterns = [
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.netlify\.app$/,
      /^https:\/\/.*\.github\.io$/,
      /^https:\/\/.*\.onrender\.com$/,
    ];

    for (const pattern of allowedPatterns) {
      if (pattern.test(origin)) {
        return callback(null, true);
      }
    }

    // For development, allow any localhost
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // Allow cookies to be sent
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// pass incoming data
app.use(cors(corsOptions));

// Global preflight handler (no wildcard path)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    const requestOrigin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", requestOrigin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health checks (avoid wildcard routes for Express 5 compatibility)
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// custom routes
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/gigs", gigRoute);
app.use("/api/orders", orderRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/messages", messageRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/admin", adminRoute);

// error handler and not found middleware
app.use(notFound);
app.use(globalErrhandler);

export default app;
