import nodemailer from "nodemailer";

// Helper that creates a transporter. If no SMTP env vars are configured,
// fall back to an Ethereal test account (useful for local development).
const createTransporter = async () => {
  const hasSmtp =
    process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS;
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

  const portNum = parseInt(process.env.EMAIL_PORT || "587", 10);
  const secure = process.env.EMAIL_SECURE === "true" || portNum === 465;

  // Add sensible timeouts and debugging flags to help diagnose socket issues
  const transportOptions = {
    host: process.env.EMAIL_HOST,
    port: portNum,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
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

const defaultFrom =
  process.env.EMAIL_FROM ||
  process.env.EMAIL_USER ||
  `no-reply@${process.env.DOMAIN || "localhost"}`;

const handleSend = async (message) => {
  const transporter = await createTransporter();
  // ensure we set a from address
  message.from = message.from || defaultFrom;

  // Verify transporter connectivity before sending to surface connection errors early
  try {
    // transporter.verify() will throw if it cannot connect/authenticate
    await transporter.verify();
  } catch (verifyErr) {
    // If verification fails, include SMTP details for easier debugging.
    const smtpInfo = {
      host: transporter.options && transporter.options.host,
      port: transporter.options && transporter.options.port,
      secure: transporter.options && transporter.options.secure,
    };
    console.error("SMTP verify failed", {
      error: verifyErr && verifyErr.message,
      smtpInfo,
    });

    // Optional fallback to Ethereal if explicitly allowed for development
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

    // otherwise rethrow to be handled by caller
    throw verifyErr;
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
      subject: "Welcome to JoyDom – Your Account Was Created Successfully!",
      html: `<p>Hi ${username}, 👋</p>

            <p>
               Your account has been <strong>created successfully</strong>. You can now log in and start exploring the platform.
            </p>

            <p>
               Whenever you're ready, you can also become a <strong>vendor</strong> and start creating service with just a click.
            </p>

            <p>
              We're excited to have you on board! 
            </p>

            <p>
               If you have any questions or need help, feel free to reply to this email or reach out to our support team.
            </p>

            <p>
              Happy Freelancing!
            </p>

            <br>

            <p>– The <strong>JoyDom Team</strong> </p>
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
    const message = {
      to,
      subject: "JoyDom | Account Verification Token",
      html: `<p>Click <a href="https://brightbediako.netlify.app/verify-email/${token}">here</a> to verify your email account.</p>`,
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
    const message = {
      to,
      subject: "JoyDom | Password Reset Code",
      html: `<p>Click 
  <a 
    href="https://brightbediako.netlify.app/reset-password/${token}" 
    style="color: #1a73e8; text-decoration: none; font-weight: bold;"
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
    const message = {
      to: to,
      subject: "JoyDom | New Product Created",
      html: `<p>${messageText}</p>

<p>
  <a 
    href="https://brightbediako.netlify.app/products/${productId}" 
    style="color: #1a73e8; text-decoration: none; font-weight: bold;" 
    target="_blank"
  >
    View Product
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
    const message = {
      to: to,
      subject: "JoyDom | New Order Placed",
      html: `<p>${messageText}</p>
        <p> <a href="https://brightbediako.netlify.app/orders/${orderId}" style="color: #1a73e8; text-decoration: none; font-weight: bold;" target="_blank">
      View Order
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
    const message = {
      to: to,
      subject: "JoyDom | Order Status Updated",
      html: `<p>${messageText}</p>
        <p> <a href="https://brightbediako.netlify.app/orders/${orderId}" style="color: #1a73e8; text-decoration: none; font-weight: bold;" target="_blank">
      View Order
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
      subject: "JoyDom – Email Update Successfully!",
      html: `<p>Hi ${username}, </p>
  
              <p> You can now log in with your new email address.</p>
  
              <br>
  
              <p>– The <strong>JoyDom Team</strong> </p>
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
