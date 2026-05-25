// ─────────────────────────────────────────────────────────────────────────────
// 16-paid-mcp-ergo-testnet — Agreement Object factory
//
// Same shape as example 15's agreement.ts, with two real-chain changes:
//
//   1. payment.reserve_ref points at the operator-provided Reserve box id
//      (set up once via `npm run setup:reserve`).
//   2. payment.deadline is denominated in *blocks* relative to the Note
//      issuance — the rails-ergo adapter resolves it against the live
//      chain height.
//
// Real flows would build this from a provider's agreement template fetched
// from /.well-known/accord/agreement-template; the demo constructs it
// inline so it stays single-process.
// ─────────────────────────────────────────────────────────────────────────────

import { accordHashV0, type AccordAgreement } from "@accord-protocol/core"

export const DEMO_AGREEMENT_ID = "acc_01HX0ERGO0TESTNET00000000000"

export interface BuildAgreementOpts {
  repo_url: string
  reserve_box_id: string
  seller_id: string
  agreement_id?: string
}

export function buildDemoAgreement(opts: BuildAgreementOpts): AccordAgreement {
  return {
    type: "accord.agreement.v0",
    version: "v0",
    agreement_id: opts.agreement_id ?? DEMO_AGREEMENT_ID,
    created_at: nowIsoUtc(),
    buyer: { id: "agent://demo-buyer-testnet" },
    seller: { id: opts.seller_id },
    task: {
      kind: "repo_audit",
      input_ref: opts.repo_url,
      description:
        "Audit a public GitHub repository for critical security issues. Paid via a real Note on Ergo testnet.",
      output_schema: "accord.audit_report.v0",
    },
    price: { amount: "0.001", currency: "ERG", decimals: 9 },
    payment: {
      mode: "note",
      rail: "ergo",
      reserve_ref: `ergo:box:${opts.reserve_box_id}`,
      deadline: "+480 blocks",
    },
    verification: {
      required: true,
      method: "verifier_receipt",
      verifier: "verifier://demo-security-v0",
      evidence_required: ["schema_valid"],
    },
    settlement: {
      mode: "inline",
      refund_policy: "expiry",
      dispute_policy: "verifier_panel",
    },
    metadata: { labels: ["demo", "ergo-testnet"] },
  }
}

export function agreementHash(agreement: AccordAgreement): string {
  return "blake2b256:0x" + accordHashV0(agreement)
}

function nowIsoUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
}
