import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io = null;

const parseCookieToken = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== "string") return null;
  const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]*)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].trim()) || null;
  } catch {
    return match[1].trim() || null;
  }
};

const resolveSocketToken = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  const header =
    socket.handshake?.headers?.authorization ||
    socket.handshake?.headers?.Authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  return parseCookieToken(socket.handshake?.headers?.cookie);
};

const buildCorsOrigin = () => {
  return (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.CLIENT_URL,
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    const patterns = [
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.netlify\.app$/,
      /^https:\/\/.*\.github\.io$/,
      /^https:\/\/.*\.onrender\.com$/,
    ];
    if (patterns.some((p) => p.test(origin))) return callback(null, true);

    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  };
};

/**
 * Attach Socket.IO to the HTTP server. Call once from server.js.
 * Clients join room `user:<userId>` after JWT auth.
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: buildCorsOrigin(),
      credentials: true,
      methods: ["GET", "POST"],
    },
    path: process.env.SOCKET_PATH || "/socket.io",
  });

  io.use((socket, next) => {
    try {
      const token = resolveSocketToken(socket);
      if (!token) {
        return next(new Error("Unauthorized"));
      }
      const payload = jwt.verify(token, process.env.JWT_KEY);
      socket.userId = String(payload.id);
      socket.isSeller = Boolean(payload.isSeller);
      socket.isEmployer = Boolean(payload.isEmployer);
      socket.isAdmin = Boolean(payload.isAdmin);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const room = `user:${socket.userId}`;
    socket.join(room);

    socket.emit("socket:ready", {
      userId: socket.userId,
      room,
    });

    socket.on("conversation:join", (conversationId) => {
      if (typeof conversationId !== "string" || !conversationId.trim()) return;
      socket.join(`conversation:${conversationId.trim()}`);
    });

    socket.on("conversation:leave", (conversationId) => {
      if (typeof conversationId !== "string" || !conversationId.trim()) return;
      socket.leave(`conversation:${conversationId.trim()}`);
    });

    socket.on("disconnect", () => {
      // room membership cleaned up automatically
    });
  });

  return io;
};

export const getIO = () => io;

/** Emit to all sockets for a user id */
export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return false;
  io.to(`user:${String(userId)}`).emit(event, payload);
  return true;
};

/** Emit to a conversation room (optional UX for open threads) */
export const emitToConversation = (conversationId, event, payload) => {
  if (!io || !conversationId) return false;
  io.to(`conversation:${String(conversationId)}`).emit(event, payload);
  return true;
};
