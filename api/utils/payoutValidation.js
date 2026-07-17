/** Payout account validation helpers (Ghana MoMo + bank). */

export const PAYOUT_METHODS = ["mobile_money", "bank"];

export const MAX_PAYOUT_ACCOUNTS = 8;

/** Digits only; MoMo must be exactly 10. */
export const isValidMomoNumber = (value) =>
  typeof value === "string" && /^\d{10}$/.test(value.trim());

/** Bank account: digits only, 8–20 length (common Ghana range). */
export const isValidBankAccountNumber = (value) =>
  typeof value === "string" && /^\d{8,20}$/.test(value.trim());

export const digitsOnly = (value) =>
  String(value || "").replace(/\D/g, "");

/**
 * Normalize + validate a payout account payload.
 * @returns {{ method, provider, accountName, accountNumber } | { error: string }}
 */
export const normalizePayoutAccountInput = (body = {}) => {
  const method =
    body.method || body.payoutMethod || body.payout_method || "";
  if (!PAYOUT_METHODS.includes(method)) {
    return {
      error: `method must be one of: ${PAYOUT_METHODS.join(", ")}`,
    };
  }

  const provider =
    typeof (body.provider ?? body.payoutProvider) === "string"
      ? String(body.provider ?? body.payoutProvider).trim().slice(0, 80)
      : "";
  const accountName =
    typeof (body.accountName ?? body.payoutAccountName) === "string"
      ? String(body.accountName ?? body.payoutAccountName).trim().slice(0, 120)
      : "";
  const rawNumber = String(
    body.accountNumber ?? body.payoutAccountNumber ?? ""
  ).trim();
  if (!provider || !accountName || !rawNumber) {
    return {
      error:
        "provider, accountName, and accountNumber are required.",
    };
  }

  // Reject letters/symbols — numbers only (spaces and dashes not allowed either)
  if (/\D/.test(rawNumber)) {
    return {
      error:
        method === "mobile_money"
          ? "MoMo number must be exactly 10 digits (numbers only)."
          : "Bank account number must be 8–20 digits (numbers only).",
    };
  }

  const accountNumber = rawNumber;

  if (method === "mobile_money") {
    if (!isValidMomoNumber(accountNumber)) {
      return {
        error: "MoMo number must be exactly 10 digits (numbers only).",
      };
    }
  } else if (method === "bank") {
    if (!isValidBankAccountNumber(accountNumber)) {
      return {
        error: "Bank account number must be 8–20 digits (numbers only).",
      };
    }
  }

  return {
    method,
    provider,
    accountName,
    accountNumber,
  };
};

/** Map stored accounts for API responses. */
export const serializePayoutAccount = (acc) => ({
  id: String(acc._id),
  method: acc.method,
  provider: acc.provider,
  accountName: acc.accountName,
  accountNumber: acc.accountNumber,
  label: acc.label || null,
  createdAt: acc.createdAt || null,
  updatedAt: acc.updatedAt || null,
});

/**
 * Build accounts list from new array + legacy single fields (migration).
 */
export const resolvePayoutAccounts = (user) => {
  const list = Array.isArray(user.payoutAccounts)
    ? user.payoutAccounts.filter(Boolean)
    : [];

  if (list.length > 0) return list;

  if (
    user.payoutMethod &&
    user.payoutMethod !== "none" &&
    user.payoutProvider &&
    user.payoutAccountName &&
    user.payoutAccountNumber
  ) {
    return [
      {
        _id: "legacy",
        method: user.payoutMethod,
        provider: user.payoutProvider,
        accountName: user.payoutAccountName,
        accountNumber: user.payoutAccountNumber,
        createdAt: user.payoutUpdatedAt || null,
        updatedAt: user.payoutUpdatedAt || null,
      },
    ];
  }

  return [];
};

/** Sync first account into legacy flat fields for older clients. */
export const syncLegacyPayoutFields = (user) => {
  const first = Array.isArray(user.payoutAccounts) && user.payoutAccounts[0];
  if (first) {
    user.payoutMethod = first.method;
    user.payoutProvider = first.provider;
    user.payoutAccountName = first.accountName;
    user.payoutAccountNumber = first.accountNumber;
  } else {
    user.payoutMethod = "none";
    user.payoutProvider = undefined;
    user.payoutAccountName = undefined;
    user.payoutAccountNumber = undefined;
  }
  user.payoutUpdatedAt = new Date();
};
