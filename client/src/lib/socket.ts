import { io, type Socket } from "socket.io-client";
import { getSocketUrl, getStoredToken } from "./api";

/** Socket.IO client tuned for Render (polling first, long reconnect). */
export function createAppSocket(): Socket | null {
  const token = getStoredToken();
  if (!token) return null;

  return io(getSocketUrl(), {
    path: "/socket.io",
    transports: ["polling", "websocket"],
    withCredentials: true,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 20000,
  });
}
