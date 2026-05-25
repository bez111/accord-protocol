import type { AccordAgreement } from "@accord-protocol/core";
import type { BuyerPolicy } from "../types.js";

export function makeAgreement(overrides: Partial<AccordAgreement> = {}): AccordAgreement {
  return {
    type: "accord.agreement.v0",
    version: "v0",
    agreement_id: "acc_01HX0BUYERPOLICY00000000",
    created_at: "2026-05-08T00:00:00Z",
    buyer: { id: "agent://buyer-test" },
    seller: { id: "provider://repo-audit-v1" },
    task: {
      kind: "repo_audit",
      input_ref: "github:https://github.com/org/repo",
      description: "Audit the repository for critical security issues.",
    },
    price: { amount: "2.50", currency: "USDC", decimals: 2 },
    payment: {
      mode: "note",
      rail: "ergo",
      reserve_ref: "ergo:box:abc",
      deadline: "+480 blocks",
    },
    verification: {
      required: true,
      method: "verifier_receipt",
      verifier: "verifier://security-v0",
    },
    settlement: {
      mode: "batchable",
      refund_policy: "expiry",
      dispute_policy: "verifier_panel",
    },
    ...overrides,
  };
}

export function makePolicy(overrides: Partial<BuyerPolicy> = {}): BuyerPolicy {
  return {
    maxSinglePayment: { amount: "5", currency: "USDC", decimals: 2 },
    maxSessionSpend: { amount: "20", currency: "USDC", decimals: 2 },
    requireApprovalAbove: { amount: "3", currency: "USDC", decimals: 2 },
    allowedRecipients: ["provider://repo-audit-v1", "provider://summarizer-*"],
    allowedRails: ["ergo", "x402"],
    sessionTtlMs: 60_000,
    ...overrides,
  };
}

/** Deterministic clock helper. */
export function fakeClock(start = 1_700_000_000_000): {
  now: () => number;
  advance: (ms: number) => void;
} {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}

/** Deterministic RNG helper for repeatable session ids. */
export function counterRng(seed = 0): (n: number) => Uint8Array {
  let i = seed;
  return (n) => {
    const buf = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      buf[k] = (i + k) & 0xff;
    }
    i += n;
    return buf;
  };
}
