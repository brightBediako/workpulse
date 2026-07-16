import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCategorySlug,
  isValidCategory,
} from "../constants/gigCategories.js";
import { computeOrderFees, getPlatformFeePercent } from "../utils/orderFees.js";
import { markOrderPaid } from "../utils/orderPayment.js";
import { createError } from "../middlewares/globalErrHandler.js";

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
