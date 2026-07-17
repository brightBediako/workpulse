import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

export const getPaystackSecretKey = () =>
  process.env.PAYSTACK_SECRET_KEY?.trim() || "";

export const isPaystackConfigured = () => Boolean(getPaystackSecretKey());

export const getPaystackCurrency = () =>
  (process.env.PAYSTACK_CURRENCY || "GHS").toUpperCase();

/** Amount in major units (e.g. GHS) → smallest unit (pesewas/kobo). */
export const toMinorUnits = (majorAmount) =>
  Math.round(Number(majorAmount) * 100);

export const createPaymentReference = () =>
  `wp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

async function paystackFetch(path, { method = "GET", body } = {}) {
  const secret = getPaystackSecretKey();
  if (!secret) {
    const err = new Error(
      "Paystack is not configured. Please set PAYSTACK_SECRET_KEY in environment variables."
    );
    err.statusCode = 500;
    throw err;
  }

  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.status === false) {
    const err = new Error(
      payload.message || `Paystack request failed (${res.status})`
    );
    err.statusCode = res.status >= 400 && res.status < 500 ? 400 : 502;
    err.paystack = payload;
    throw err;
  }

  return payload.data;
}

/**
 * Initialize a Paystack transaction (hosted checkout).
 * @returns {{ authorization_url, access_code, reference }}
 */
export const initializeTransaction = async ({
  email,
  amountMajor,
  reference,
  callbackUrl,
  metadata = {},
}) => {
  const data = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: String(toMinorUnits(amountMajor)),
      currency: getPaystackCurrency(),
      reference,
      callback_url: callbackUrl,
      metadata,
    },
  });

  return {
    authorization_url: data.authorization_url,
    access_code: data.access_code,
    reference: data.reference || reference,
  };
};

/**
 * Verify a transaction by reference.
 * @returns {object} Paystack transaction data
 */
export const verifyTransaction = async (reference) => {
  if (!reference) {
    const err = new Error("Payment reference is required!");
    err.statusCode = 400;
    throw err;
  }
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
};

/**
 * Validate Paystack webhook signature (HMAC SHA512 of raw body).
 * @param {Buffer|string} rawBody
 * @param {string} signatureHeader x-paystack-signature
 */
export const verifyWebhookSignature = (rawBody, signatureHeader) => {
  const secret = getPaystackSecretKey();
  if (!secret || !signatureHeader) return false;

  const body =
    Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ""), "utf8");
  const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");

  try {
    const a = Buffer.from(hash, "utf8");
    const b = Buffer.from(String(signatureHeader), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};
