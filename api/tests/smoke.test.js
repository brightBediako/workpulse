import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  normalizeCategorySlug,
  isValidCategory,
} from "../constants/gigCategories.js";
import { computeOrderFees, getPlatformFeePercent } from "../utils/orderFees.js";
import { markOrderPaid } from "../utils/orderPayment.js";
import { createError } from "../middlewares/globalErrHandler.js";
import {
  toMinorUnits,
  verifyWebhookSignature,
} from "../services/paystackService.js";

describe("gig categories", () => {
  it("normalizes known slugs and labels", () => {
    assert.equal(normalizeCategorySlug("plumbing"), "plumbing");
    assert.equal(normalizeCategorySlug("Plumbing"), "plumbing");
    assert.equal(normalizeCategorySlug("  ELECTRICAL "), "electrical");
    assert.equal(normalizeCategorySlug("not-a-real-cat"), null);
    assert.equal(isValidCategory("cleaning"), true);
    assert.equal(isValidCategory(""), false);
  });
});

describe("order fees", () => {
  it("splits price at default 10% platform fee", () => {
    const { platformFee, sellerEarnings, feePercent } = computeOrderFees(100);
    assert.equal(feePercent, getPlatformFeePercent());
    assert.equal(platformFee, 10);
    assert.equal(sellerEarnings, 90);
  });

  it("handles zero price", () => {
    const { platformFee, sellerEarnings } = computeOrderFees(0);
    assert.equal(platformFee, 0);
    assert.equal(sellerEarnings, 0);
  });
});

describe("markOrderPaid", () => {
  it("is idempotent when order already paid", async () => {
    const order = {
      isCompleted: true,
      price: 50,
      title: "Test",
      sellerId: "s1",
      gigId: "g1",
      _id: "o1",
    };
    const result = await markOrderPaid(order);
    assert.equal(result.alreadyPaid, true);
    assert.equal(result.order.isCompleted, true);
  });
});

describe("createError", () => {
  it("attaches statusCode for the global handler", () => {
    const err = createError(403, "Forbidden");
    assert.equal(err.statusCode, 403);
    assert.equal(err.message, "Forbidden");
  });
});

describe("paystack helpers", () => {
  it("converts major units to pesewas/kobo", () => {
    assert.equal(toMinorUnits(100), 10000);
    assert.equal(toMinorUnits(12.5), 1250);
  });

  it("verifies webhook HMAC signatures", () => {
    process.env.PAYSTACK_SECRET_KEY = "test_secret";
    const body = Buffer.from(JSON.stringify({ event: "charge.success" }));
    const good = crypto
      .createHmac("sha512", "test_secret")
      .update(body)
      .digest("hex");
    assert.equal(verifyWebhookSignature(body, good), true);
    assert.equal(verifyWebhookSignature(body, "bad"), false);
  });
});
