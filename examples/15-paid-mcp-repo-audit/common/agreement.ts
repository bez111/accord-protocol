// ─────────────────────────────────────────────────────────────────────────────
// 15-paid-mcp-repo-audit — Agreement Object factory
//
// Helper that produces a v0 Accord Agreement for the demo. Real flows would
// build this from a provider's agreement template fetched from /.well-known/
// accord/agreement-template; here we just construct it inline so the demo is
// self-contained.
// ─────────────────────────────────────────────────────────────────────────────

import { accordHashV0, type AccordAgreement } from "@accord-protocol/core";

/** Stable agreement_id for the demo — re-use across buyer / seller / verifier. */
export const DEMO_AGREEMENT_ID = "acc_01HX0DEMO00000000000000000";

/** Create the demo's Agreement Object. The repo URL is the only real input. */
export function buildDemoAgreement(opts: {
  repo_url: string;
  agreement_id?: string;
}): AccordAgreement {
  return {
    type: "accord.agreement.v0",
    version: "v0",
    agreement_id: opts.agreement_id ?? DEMO_AGREEMENT_ID,
    created_at: nowIsoUtc(),
    buyer: { id: "agent://demo-buyer" },
    seller: { id: "provider://demo-repo-audit" },
    task: {
      kind: "repo_audit",
      input_ref: opts.repo_url,
      description: "Audit repository for critical security issues. Demo flow.",
      output_schema: "accord.audit_report.v0",
    },
    price: { amount: "0.001", currency: "ERG", decimals: 9 },
    payment: {
      mode: "note",
      rail: "ergo",
      reserve_ref: "ergo:box:" + "ab".repeat(32),
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
    metadata: { labels: ["demo"] },
  };
}

export function agreementHash(agreement: AccordAgreement): string {
  return "blake2b256:0x" + accordHashV0(agreement);
}

function nowIsoUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
