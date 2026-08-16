import http from "http";
import dotenv from "dotenv";
import app from "./app/app.js";
import { initSocket } from "./socket/index.js";
import { getSmtpStatus } from "./services/emailService.js";

dotenv.config();

const PORT = process.env.PORT || 8000;
const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server is up and running on port ${PORT}`);
  console.log(`Socket.IO path: ${process.env.SOCKET_PATH || "/socket.io"}`);
  const mail = getSmtpStatus();
  if (mail.configured) {
    console.log(
      `Email: SMTP ${mail.host}:${mail.port} (from ${mail.from})`
    );
  } else {
    console.log("Email: Ethereal test mode (set MAIL_SMTP_* in .env for real mail)");
  }
});
