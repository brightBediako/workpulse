import nodemailer from "nodemailer";

const smtpConfig = () => {
  const host = process.env.EMAIL_HOST || process.env.MAIL_SMTP_HOST;
  const user = process.env.EMAIL_USER || process.env.MAIL_SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.MAIL_SMTP_PASS;
  const portRaw = process.env.EMAIL_PORT || process.env.MAIL_SMTP_PORT || "587";
  const portNum = parseInt(portRaw, 10);
  const secure =
    process.env.EMAIL_SECURE === "true" ||
    process.env.MAIL_SMTP_ENCRYPTION === "ssl" ||
    portNum === 465;

  return { host, user, pass, portNum, secure };
};

/** True when real SMTP credentials are present (not Ethereal fallback). */
export const isSmtpConfigured = () => {
  const { host, user, pass } = smtpConfig();
  return Boolean(host && user && pass);
};

/** Safe summary for logs / health checks — never includes secrets. */
export const getSmtpStatus = () => {
  const { host, portNum, secure, user } = smtpConfig();
  if (!isSmtpConfigured()) {
    return { mode: "ethereal", configured: false };
  }
  return {
    mode: "smtp",
    configured: true,
    host,
    port: portNum,
    secure,
    user,
    from: defaultFromAddress(),
  };
};

const defaultFromAddress = () => {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.MAIL_FROM_NAME && process.env.MAIL_FROM) {
    return `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM}>`;
  }
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  const { user } = smtpConfig();
  return user || `no-reply@${process.env.DOMAIN || "localhost"}`;
};

const defaultReplyTo = () =>
  process.env.MAIL_TO || process.env.MAIL_FROM || undefined;

const shouldVerifySmtp =
  () => process.env.EMAIL_SMTP_VERIFY === "true";

// Helper that creates a transporter. If no SMTP env vars are configured,
// fall back to an Ethereal test account (useful for local development).
const createTransporter = async () => {
  const { host, user, pass, portNum, secure } = smtpConfig();
  const hasSmtp = host && user && pass;
  if (!hasSmtp) {
    // Create a test account and return a transporter for it
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    transporter._isTestAccount = true; // mark for logging the preview URL
    return transporter;
  }

  // Add sensible timeouts and debugging flags to help diagnose socket issues
  const transportOptions = {
    host,
    port: portNum,
    secure,
    auth: {
      user,
      pass,
    },
    logger: process.env.EMAIL_DEBUG === "true",
    debug: process.env.EMAIL_DEBUG === "true",
    connectionTimeout: parseInt(process.env.EMAIL_CONN_TIMEOUT || "10000", 10),
    greetingTimeout: parseInt(
      process.env.EMAIL_GREETING_TIMEOUT || "10000",
      10
    ),
    socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT || "10000", 10),
    tls: {
      // allow opting out of strict TLS verification in development via env
      rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  };

  return nodemailer.createTransport(transportOptions);
};

const clientBaseUrl = () =>
  (process.env.CLIENT_URL || process.env.DOMAIN || "http://localhost:5173").replace(
    /\/$/,
    ""
  );

const handleSend = async (message) => {
  const transporter = await createTransporter();
  message.from = message.from || defaultFromAddress();
  if (!message.replyTo && defaultReplyTo()) {
    message.replyTo = defaultReplyTo();
  }

  const usingRealSmtp = isSmtpConfigured() && !transporter._isTestAccount;

  // Optional verify — off by default for real SMTP (sendMail still validates auth)
  if (shouldVerifySmtp() || !usingRealSmtp) {
    try {
      await transporter.verify();
    } catch (verifyErr) {
      const smtpInfo = {
        host: transporter.options?.host,
        port: transporter.options?.port,
        secure: transporter.options?.secure,
      };
      console.error("SMTP verify failed", {
        error: verifyErr?.message,
        smtpInfo,
      });

      if (process.env.EMAIL_FALLBACK_TO_ETHEREAL === "true") {
        console.warn(
          "Falling back to Ethereal test account due to SMTP verify failure"
        );
        const testAccount = await nodemailer.createTestAccount();
        const ethTransporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        ethTransporter._isTestAccount = true;
        const info = await ethTransporter.sendMail(message);
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) console.log("Ethereal preview URL:", preview);
        return info;
      }

      throw verifyErr;
    }
  }

  const info = await transporter.sendMail(message);

  // If using Ethereal, print the preview URL to the console to help debugging
  if (transporter._isTestAccount) {
    const preview = nodemailer.getTestMessageUrl(info);
    console.log("Ethereal preview URL:", preview);
  }

  return info;
};

export const sendRegisterNotificationEmail = async (to, username) => {
  try {
    const message = {
      to: to,
      subject: "Welcome to WorkPulse Connect — your account is ready",
      html: `<p>Hi ${username || "there"},</p>

            <p>
               Your <strong>WorkPulse Connect</strong> account has been <strong>created successfully</strong>. You can log in to find skilled workers or offer your services.
            </p>

            <p>
               Whenever you're ready, switch on <strong>seller mode</strong> and publish a service listing (gig) for customers to discover.
            </p>

            <p>
              We're excited to have you on board.
            </p>

            <p>
               If you have any questions, reply to this email or contact support.
            </p>

            <p>
              Welcome to the marketplace.
            </p>

            <br>

            <p>— The <strong>WorkPulse Connect</strong> team</p>
            `,
    };
    const info = await handleSend(message);
    return info;
  } catch (error) {
    console.error("sendRegisterNotificationEmail error:", error);
    throw new Error(
      "Notification not sent: " +
        (error && error.message ? error.message : "unknown")
    );
  }
};

//
export const sendVerificationEmail = async (to, token) => {
  try {
    const base = clientBaseUrl();
    const message = {
      to,
      subject: "WorkPulse Connect | Verify your email",
      html: `<p>Click <a href="${base}/verify-email/${token}">here</a> to verify your email account.</p>`,
    };
    const info = await handleSend(message);
    return info;
  } catch (error) {
    console.error("sendVerificationEmail error:", error);
    throw new Error(
      "Email not sent: " + (error && error.message ? error.message : "unknown")
    );
  }
};

export const sendPasswordResetEmail = async (to, token) => {
  try {
    const base = clientBaseUrl();
    const message = {
      to,
      subject: "WorkPulse Connect | Password reset",
      html: `<p>Click 
  <a 
    href="${base}/reset-password/${token}" 
    style="color: #06382d; text-decoration: none; font-weight: bold;"
    target="_blank"
  >
    here
  </a> 
  to reset your password.
</p>`,
    };
    const info = await handleSend(message);
    return info;
  } catch (error) {
    console.error("sendPasswordResetEmail error:", error);
    throw new Error(
      "Email not sent: " + (error && error.message ? error.message : "unknown")
    );
  }
};

export const sendProductNotificationEmail = async (
  to,
  productId,
  messageText
) => {
  try {
    const base = clientBaseUrl();
    const message = {
      to: to,
      subject: "WorkPulse Connect | New service listing",
      html: `<p>${messageText}</p>

<p>
  <a 
    href="${base}/gigs/${productId}" 
    style="color: #06382d; text-decoration: none; font-weight: bold;" 
    target="_blank"
  >
    View listing
  </a>
</p>
`,
    };
    const info = await handleSend(message);
    return info;
  } catch (error) {
    console.error("sendProductNotificationEmail error:", error);
    throw new Error(
      "Notification not sent: " +
        (error && error.message ? error.message : "unknown")
    );
  }
};

export const sendOrderNotificationEmail = async (to, orderId, messageText) => {
  try {
    const base = clientBaseUrl();
    const message = {
      to: to,
      subject: "WorkPulse Connect | New order placed",
      html: `<p>${messageText}</p>
        <p> <a href="${base}/orders/${orderId}" style="color: #06382d; text-decoration: none; font-weight: bold;" target="_blank">
      View order
    </a>
  </p>
  `,
    };
    const info = await handleSend(message);
    return info;
  } catch (error) {
    console.error("sendOrderNotificationEmail error:", error);
    throw new Error(
      "Notification not sent: " +
        (error && error.message ? error.message : "unknown")
    );
  }
};

export const sendOrderUpdateNotificationEmail = async (
  to,
  orderId,
  messageText
) => {
  try {
    const base = clientBaseUrl();
    const message = {
      to: to,
      subject: "WorkPulse Connect | Order status updated",
      html: `<p>${messageText}</p>
        <p> <a href="${base}/orders/${orderId}" style="color: #06382d; text-decoration: none; font-weight: bold;" target="_blank">
      View order
    </a>
  </p>
  `,
    };
    const info = await handleSend(message);
    return info;
  } catch (error) {
    console.error("sendOrderUpdateNotificationEmail error:", error);
    throw new Error(
      "Notification not sent: " +
        (error && error.message ? error.message : "unknown")
    );
  }
};

export const sendUpdateNotificationEmail = async (to, username) => {
  try {
    const message = {
      to: to,
      subject: "WorkPulse Connect — email updated successfully",
      html: `<p>Hi ${username || "there"},</p>
  
              <p>You can now log in to WorkPulse Connect with your new email address.</p>
  
              <br>
  
              <p>— The <strong>WorkPulse Connect</strong> team</p>
              `,
    };
    const info = await handleSend(message);
    return info;
  } catch (error) {
    console.error("sendUpdateNotificationEmail error:", error);
    throw new Error(
      "Notification not sent: " +
        (error && error.message ? error.message : "unknown")
    );
  }
};
