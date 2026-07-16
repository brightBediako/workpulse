import http from "http";
import dotenv from "dotenv";
import app from "./app/app.js";
import { initSocket } from "./socket/index.js";

dotenv.config();

const PORT = process.env.PORT || 8000;
const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server is up and running on port ${PORT}`);
  console.log(`Socket.IO path: ${process.env.SOCKET_PATH || "/socket.io"}`);
});
