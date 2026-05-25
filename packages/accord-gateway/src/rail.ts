// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/gateway — rail adapter interface
//
// Same shape as the one in @accord-protocol/mcp's types.ts, kept local
// here so accord-gateway doesn't take a dependency on accord-mcp. PR-012
// will lift the canonical interface into a shared `@accord-protocol/rails`
// package and both consumers will re-export from there.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AccordAgreement,
  AccordSettlementReceipt,
  AccordVerificationReceipt,
} from "@accord-protocol/core";

export type AccordPaymentProof = unknown;

export interface AccordRailAdapter {
  rail: string;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  settle?(input: SettleInput): Promise<AccordSettlementReceipt>;
}

export interface VerifyPaymentInput {
  agreement: AccordAgreement;
  payment: AccordPaymentProof;
}

export type VerifyPaymentResult =
  | {
      ok: true;
      rail: string;
      /**
       * Stable per-payment id the gateway uses for replay protection.
       * For Ergo Notes this is the box id; for Base it's the tx hash;
       * for x402 it should be the facilitator's unique payment id.
       * The gateway binds this id to `(Accord version, rail, payment_id)`
       * and rejects calls whose id was claimed in the past TTL.
       */
       payment_id: string;
       /** Optional rail-specific bag of debugging data. */
       details?: Record<string, unknown>;
    }
  | { ok: false; rail: string; code: string; message: string };

export interface SettleInput {
  agreement: AccordAgreement;
  payment: AccordPaymentProof;
  verification?: AccordVerificationReceipt;
}
