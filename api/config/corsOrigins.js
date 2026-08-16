const STATIC_ORIGINS = [
  "https://workpulse-omega.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

const ORIGIN_PATTERNS = [
  /^https:\/\/[\w.-]+\.vercel\.app$/,
  /^https:\/\/[\w.-]+\.netlify\.app$/,
  /^https:\/\/[\w.-]+\.github\.io$/,
  /^https:\/\/[\w.-]+\.onrender\.com$/,
];

export function getAllowedOrigins() {
  const origins = [...STATIC_ORIGINS];
  const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");
  if (clientUrl && !origins.includes(clientUrl)) {
    origins.push(clientUrl);
  }
  return origins;
}

export function isOriginAllowed(origin) {
  if (!origin) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  if (ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) return true;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return true;
  }
  return false;
}

/** Shared by Express cors() and Socket.IO — never throw; reflect allowed origin. */
export function corsOriginCallback(origin, callback) {
  if (!origin || isOriginAllowed(origin)) {
    return callback(null, origin || true);
  }
  callback(null, false);
}

export const expressCorsOptions = {
  origin: corsOriginCallback,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  optionsSuccessStatus: 200,
};

export const socketCorsOptions = {
  origin: corsOriginCallback,
  credentials: true,
  methods: ["GET", "POST"],
};
