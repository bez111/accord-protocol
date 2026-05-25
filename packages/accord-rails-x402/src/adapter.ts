// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/rails-x402 — x402-compatible HTTP rail adapter
//
// Per ACCORD-003 the x402 rail's only allowed mode is `paid_before_response`
// — payment is verified atomically before the response is served. We don't
// distinguish verify and settle the way Note rails do; the facilitator's
// `verify` either gives us a confirmed payment or it doesn't.
// ─────────────────────────────────────────────────────────────────────────────

import {
  accordHashV0,
  type AccordSettlementReceipt,
} from "@accord-protocol/core";

import type {
  AccordRailAdapter,
  SettleInput,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "@accord-protocol/rails";

import type {
  X402Facilitator,
  X402PaymentProof,
  X402RailAdapterOptions,
} from "./types.js";

export const X402_RAIL_ERROR_CODES = {
  INVALID_PAYMENT_SHAPE: "INVALID_PAYMENT_SHAPE",
  FACILITATOR_REJECTED: "FACILITATOR_REJECTED",
  FACILITATOR_UNAVAILABLE: "FACILITATOR_UNAVAILABLE",
  CURRENCY_NOT_SUPPORTED: "CURRENCY_NOT_SUPPORTED",
} as const;

/** Currencies x402 commonly carries. The facilitator does the real check. */
const SUPPORTED_CURRENCIES = new Set(["USDC", "USDT"]);

export function createX402RailAdapter(opts: X402RailAdapterOptions): AccordRailAdapter {
  const network = opts.network ?? mapNetwork(opts.facilitator.network);
  const facilitator = opts.facilitator;

  return {
    rail: "x402",
    verifyPayment: (input) => verifyPayment(facilitator, input),
    settle: (input) => settle(facilitator, network, input),
  };
}

// ── verifyPayment ───────────────────────────────────────────────────────────

async function verifyPayment(
  facilitator: X402Facilitator,
  input: VerifyPaymentInput,
): Promise<VerifyPaymentResult> {
  // 1. Shape.
  const proof = input.payment as Partial<X402PaymentProof> | null | undefined;
  if (!proof || typeof proof !== "object") {
    return rejection("INVALID_PAYMENT_SHAPE", "payment must be an object");
  }
  if (
    typeof proof.x402_payment_payload !== "string" ||
    proof.x402_payment_payload.trim().length === 0
  ) {
    return rejection(
      "INVALID_PAYMENT_SHAPE",
      "payment.x402_payment_payload must be a non-empty string",
    );
  }
  if (
    proof.scheme !== undefined &&
    (typeof proof.scheme !== "string" || proof.scheme.trim().length === 0)
  ) {
    return rejection(
      "INVALID_PAYMENT_SHAPE",
      "payment.scheme must be a non-empty string when provided",
    );
  }
  const scheme = proof.scheme ?? "exact";

  // 2. Currency sanity-check at the rail boundary. The facilitator decides
  //    the real currency, but we reject obvious mismatches early so the
  //    error surface is clear.
  if (!SUPPORTED_CURRENCIES.has(input.agreement.price.currency)) {
    return rejection(
      "CURRENCY_NOT_SUPPORTED",
      `rails-x402 supports {USDC, USDT} at v0; agreement asks for ${input.agreement.price.currency}.`,
    );
  }

  // 3. Hand the payload to the facilitator.
  let result;
  try {
    result = await facilitator.verify({
      agreement: input.agreement,
      paymentPayload: proof.x402_payment_payload,
      scheme,
    });
  } catch (err) {
    return rejection(
      "FACILITATOR_UNAVAILABLE",
      `facilitator.verify threw: ${stringifyError(err)}`,
    );
  }
  if (!result.ok) {
    return {
      ok: false,
      rail: "x402",
      code: X402_RAIL_ERROR_CODES.FACILITATOR_REJECTED,
      message: `${result.code}: ${result.message}`,
    };
  }
  if (
    typeof result.payment_id !== "string" ||
    result.payment_id.trim().length === 0 ||
    typeof result.scheme !== "string" ||
    result.scheme.trim().length === 0
  ) {
    return rejection(
      "FACILITATOR_REJECTED",
      "facilitator returned an invalid success shape",
    );
  }

  return {
    ok: true,
    rail: "x402",
    payment_id: makePaymentId({
      facilitatorNetwork: facilitator.network,
      paymentPayload: proof.x402_payment_payload,
      scheme,
    }),
    details: {
      ...(result.details ?? {}),
      scheme: result.scheme,
      payer: result.payer ?? null,
      facilitator_network: facilitator.network,
      facilitator_payment_id: result.payment_id,
    },
  };
}

// ── settle ──────────────────────────────────────────────────────────────────

async function settle(
  facilitator: X402Facilitator,
  network: X402RailAdapterOptions["network"],
  input: SettleInput,
): Promise<AccordSettlementReceipt> {
  const proof = input.payment as X402PaymentProof;
  const scheme = proof.scheme ?? "exact";

  // Re-derive Accord's stable replay id from the opaque payload and call
  // facilitator.verify again to recover the facilitator's own payment id.
  // If facilitator.settle is implemented, prefer the on-chain tx_hash it
  // returns for the Settlement Receipt tx anchor.
  const accordPaymentId = makePaymentId({
    facilitatorNetwork: facilitator.network,
    paymentPayload: proof.x402_payment_payload,
    scheme,
  });
  let facilitatorPaymentId: string;
  try {
    const v = await facilitator.verify({
      agreement: input.agreement,
      paymentPayload: proof.x402_payment_payload,
      scheme,
    });
    if (!v.ok) {
      throw new Error(`facilitator rejected during settle: ${v.code}: ${v.message}`);
    }
    facilitatorPaymentId = v.payment_id;
  } catch (err) {
    throw new Error(`rails-x402 settle: ${stringifyError(err)}`);
  }

  let txHash = facilitatorPaymentId;
  let blockHeight: number | undefined;
  if (facilitator.settle) {
    try {
      const r = await facilitator.settle({
        agreement: input.agreement,
        paymentPayload: proof.x402_payment_payload,
        scheme,
        payment_id: facilitatorPaymentId,
      });
      txHash = r.tx_hash;
      blockHeight = r.block_height;
    } catch {
      // The facilitator's verify already confirmed the payment is good;
      // a settle-step failure just means the tx isn't on-chain yet (or
      // the facilitator doesn't expose settle). Fall back to payment_id
      // as the receipt's tx_id and let the caller reconcile out-of-band.
    }
  }

  const agreement = input.agreement;
  const tx: AccordSettlementReceipt["tx"] = {
    network: (network ?? "base-sepolia") as AccordSettlementReceipt["tx"]["network"],
    tx_id: txHash,
  };
  if (blockHeight !== undefined) {
    tx.block_height = blockHeight;
  }

  return {
    type: "accord.settlement_receipt.v0",
    version: "v0",
    settlement_id: makeSettlementId(agreement.agreement_id, accordPaymentId),
    agreement_id: agreement.agreement_id,
    agreement_hash: "blake2b256:0x" + accordHashV0(agreement),
    ...(input.verification
      ? { verification_receipts: [input.verification.receipt_id] }
      : {}),
    rail: "x402",
    mode: "paid_before_response",
    status: "settled",
    amount: agreement.price.amount,
    currency: agreement.price.currency,
    decimals: agreement.price.decimals,
    tx,
    created_at: nowIsoUtc(),
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function rejection(
  codeKey: keyof typeof X402_RAIL_ERROR_CODES,
  message: string,
): VerifyPaymentResult {
  return { ok: false, rail: "x402", code: X402_RAIL_ERROR_CODES[codeKey], message };
}

/** Map a facilitator-defined network string to the Settlement Receipt enum. */
function mapNetwork(net: string): X402RailAdapterOptions["network"] {
  switch (net.toLowerCase()) {
    case "ethereum":
    case "mainnet":
      return "mainnet";
    case "base-sepolia":
      return "base-sepolia";
    case "sepolia":
      return "sepolia";
    case "base":
      // No "base" enum in core's tx.network for v0 — use 'mainnet' to mean
      // Base mainnet, with the rail name 'x402' carrying the chain context.
      return "mainnet";
    default:
      return "testnet";
  }
}

function makeSettlementId(agreementId: string, anchor: string): string {
  const seed = `${agreementId}:${anchor}`;
  const hash = accordHashV0(seed);
  const base32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let out = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; out.length < 26; i = (i + 1) % hash.length) {
    value = (value << 4) | parseInt(hash[i] as string, 16);
    bits += 4;
    if (bits >= 5) {
      bits -= 5;
      out += base32[(value >> bits) & 0x1f] as string;
    }
  }
  return "sr_" + out;
}

function makePaymentId(input: {
  facilitatorNetwork: string;
  paymentPayload: string;
  scheme: string;
}): string {
  const paymentPayloadHash = "blake2b256:0x" + accordHashV0(input.paymentPayload);
  const hash = accordHashV0({
    type: "accord.x402_payment_id.v0",
    version: "v0",
    rail: "x402",
    facilitator_network: input.facilitatorNetwork,
    scheme: input.scheme,
    payment_payload_hash: paymentPayloadHash,
  });
  return "x402_" + hash;
}

function nowIsoUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
