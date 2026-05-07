// ─────────────────────────────────────────────────────────────────────────────
// 15-paid-mcp-repo-audit — minimal in-process Mock rail adapter
//
// Implements the AccordRailAdapter interface from @accord-protocol/rails. We
// inline a tiny mock here (rather than depending on @accord-protocol/rails/mock)
// to keep the demo self-contained — running it should not require any
// non-published packages besides what's pinned in package.json.
//
// The MockPayment carries a decimal-string `value`; verifyPayment accepts iff
// value >= agreement.price.amount. Settlement Receipts pass core's
// validateSettlementReceipt.
// ─────────────────────────────────────────────────────────────────────────────

import {
  accordHashV0,
  type AccordAgreement,
  type AccordSettlementReceipt,
} from "@accord-protocol/core";
import type {
  AccordRailAdapter,
  SettleInput,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "@accord-protocol/rails";

export interface MockPayment {
  value: string;
  payment_id?: string;
}

export const demoRail: AccordRailAdapter = {
  rail: "ergo",
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const p = (input.payment ?? {}) as Partial<MockPayment>;
    if (typeof p.value !== "string") {
      return {
        ok: false,
        rail: "ergo",
        code: "MISSING_VALUE",
        message: "demo payment requires a string `value`",
      };
    }
    if (compareDecimal(p.value, input.agreement.price.amount) < 0) {
      return {
        ok: false,
        rail: "ergo",
        code: "INSUFFICIENT_VALUE",
        message: `demo payment value ${p.value} < required ${input.agreement.price.amount}`,
      };
    }
    return {
      ok: true,
      rail: "ergo",
      payment_id: p.payment_id ?? "demo-" + accordHashV0(p).slice(0, 16),
      details: { mock: true },
    };
  },

  async settle(input: SettleInput): Promise<AccordSettlementReceipt> {
    return demoSettle(input.agreement, "settled", "note_redeemed");
  },
};

function demoSettle(
  agreement: AccordAgreement,
  status: "settled" | "refunded",
  mode: "note_redeemed" | "reserve_refunded",
): AccordSettlementReceipt {
  const seed = `${agreement.agreement_id}:${status}`;
  return {
    type: "accord.settlement_receipt.v0",
    version: "v0",
    settlement_id:
      "sr_" +
      makeBase32Id(seed),
    agreement_id: agreement.agreement_id,
    agreement_hash: "blake2b256:0x" + accordHashV0(agreement),
    rail: "ergo",
    mode,
    status,
    amount: agreement.price.amount,
    currency: agreement.price.currency,
    decimals: agreement.price.decimals,
    tx: {
      network: "testnet",
      tx_id: "0x" + accordHashV0("demo-tx:" + seed),
      box_id: "0x" + accordHashV0("demo-box:" + seed),
    },
    created_at: nowIsoUtc(),
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function compareDecimal(a: string, b: string): number {
  const [aInt = "0", aFrac = ""] = a.split(".");
  const [bInt = "0", bFrac = ""] = b.split(".");
  const intLen = Math.max(aInt.length, bInt.length);
  const aIp = aInt.padStart(intLen, "0");
  const bIp = bInt.padStart(intLen, "0");
  if (aIp !== bIp) return aIp < bIp ? -1 : 1;
  const fracLen = Math.max(aFrac.length, bFrac.length);
  const aFp = aFrac.padEnd(fracLen, "0");
  const bFp = bFrac.padEnd(fracLen, "0");
  if (aFp === bFp) return 0;
  return aFp < bFp ? -1 : 1;
}

function makeBase32Id(seed: string): string {
  const hash = accordHashV0(seed);
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let out = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; out.length < 26; i = (i + 1) % hash.length) {
    value = (value << 4) | parseInt(hash[i] as string, 16);
    bits += 4;
    if (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >> bits) & 0x1f] as string;
    }
  }
  return out;
}

function nowIsoUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
