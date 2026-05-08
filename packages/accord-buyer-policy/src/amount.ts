// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/buyer-policy — safe BigInt amount math
//
// Every amount that crosses a policy boundary is parsed through parseAmount()
// and stored as a BigInt scaled by `decimals`. This eliminates two classes of
// bugs:
//
//   1. JS Number precision drift — a `0.1 + 0.2 !== 0.3` issue would let an
//      agent drift just under a cap with floating-point noise.
//
//   2. Heterogeneous units — adding 5_USD with decimals=2 to 5_USD with
//      decimals=6 would silently produce nonsense. Comparing scaled BigInts
//      against the policy's scale forces an explicit decision.
//
// The parser intentionally rejects scientific notation, leading +, multiple
// dots, non-digits, and silent zero-padding mismatches.
// ─────────────────────────────────────────────────────────────────────────────

import { BuyerPolicyError } from "./errors.js";

export interface ScaledAmount {
  /** Decimal string, normalized (no leading zeros, no trailing zeros past `decimals`). */
  readonly amount: string;
  readonly currency: string;
  readonly decimals: number;
  /** Integer-scaled value: e.g. "5.00" with decimals=2 → 500n. */
  readonly scaled: bigint;
}

const DEC_RE = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

/**
 * Parse and validate a decimal-string amount + decimals.
 *
 * Always non-negative. Use a separate sign field if a negative number is
 * needed (the buyer-policy API never has a legitimate use for one).
 */
export function parseAmount(
  amount: string,
  currency: string,
  decimals: number,
): ScaledAmount {
  if (typeof amount !== "string") {
    throw new BuyerPolicyError(
      "POLICY_INVALID_AMOUNT_FORMAT",
      "amount must be a decimal string, never a JS number",
    );
  }
  if (typeof currency !== "string" || currency.length === 0 || currency.length > 16) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_AMOUNT_FORMAT",
      "currency must be a non-empty string ≤16 chars",
    );
  }
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 30
  ) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_AMOUNT_FORMAT",
      "decimals must be an integer in [0, 30]",
    );
  }
  const m = DEC_RE.exec(amount);
  if (!m) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_AMOUNT_FORMAT",
      "amount must match /^(0|[1-9][0-9]*)(\\.[0-9]+)?$/",
    );
  }
  const whole = m[1] ?? "0";
  const frac = m[2] ?? "";
  if (frac.length > decimals) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_AMOUNT_FORMAT",
      `amount has more fractional digits (${frac.length}) than decimals (${decimals})`,
    );
  }
  const padded = frac.padEnd(decimals, "0");
  // BigInt(string) accepts only digits — guarded by DEC_RE above.
  const scaled = BigInt(whole + padded);
  return {
    amount,
    currency,
    decimals,
    scaled,
  };
}

/**
 * Compare two ScaledAmounts. Throws if currency or decimals differ — this is
 * deliberately strict, since cross-currency conversion belongs in a separate
 * oracle layer the integrator wires up.
 */
export function lte(a: ScaledAmount, b: ScaledAmount): boolean {
  if (a.currency !== b.currency || a.decimals !== b.decimals) {
    throw new BuyerPolicyError(
      "CURRENCY_MISMATCH",
      `cannot compare ${a.currency}@${a.decimals} with ${b.currency}@${b.decimals}`,
    );
  }
  return a.scaled <= b.scaled;
}

export function gt(a: ScaledAmount, b: ScaledAmount): boolean {
  return !lte(a, b);
}

/**
 * Add two ScaledAmounts. Throws if currency or decimals differ.
 */
export function add(a: ScaledAmount, b: ScaledAmount): ScaledAmount {
  if (a.currency !== b.currency || a.decimals !== b.decimals) {
    throw new BuyerPolicyError(
      "CURRENCY_MISMATCH",
      `cannot add ${a.currency}@${a.decimals} with ${b.currency}@${b.decimals}`,
    );
  }
  const sum = a.scaled + b.scaled;
  return {
    amount: scaledToDecimal(sum, a.decimals),
    currency: a.currency,
    decimals: a.decimals,
    scaled: sum,
  };
}

/**
 * Render a scaled BigInt back into a decimal string with `decimals` places.
 */
export function scaledToDecimal(scaled: bigint, decimals: number): string {
  if (scaled < 0n) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_AMOUNT_FORMAT",
      "scaledToDecimal cannot represent a negative value",
    );
  }
  if (decimals === 0) return scaled.toString();
  const s = scaled.toString().padStart(decimals + 1, "0");
  const cut = s.length - decimals;
  const whole = s.slice(0, cut);
  const frac = s.slice(cut).replace(/0+$/, "");
  return frac.length === 0 ? whole : `${whole}.${frac}`;
}

/**
 * Sentinel zero amount in the same currency / decimals as the reference.
 */
export function zero(reference: { currency: string; decimals: number }): ScaledAmount {
  return {
    amount: "0",
    currency: reference.currency,
    decimals: reference.decimals,
    scaled: 0n,
  };
}
