/**
 * Platform fee for paid orders.
 * Default 10% (matches admin dashboard assumptions). Override with PLATFORM_FEE_PERCENT.
 */
export const getPlatformFeePercent = () => {
  const pct = parseFloat(process.env.PLATFORM_FEE_PERCENT || "10");
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 10;
  return pct;
};

export const getPlatformFeeRate = () => getPlatformFeePercent() / 100;

/**
 * Split order price into platform fee and seller earnings (2 decimal places).
 */
export const computeOrderFees = (price) => {
  const amount = Number(price) || 0;
  const rate = getPlatformFeeRate();
  const platformFee = Math.round(amount * rate * 100) / 100;
  const sellerEarnings = Math.round((amount - platformFee) * 100) / 100;
  return {
    platformFee,
    sellerEarnings,
    feePercent: getPlatformFeePercent(),
  };
};
