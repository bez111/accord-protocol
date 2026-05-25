// ─────────────────────────────────────────────────────────────────────────────
// Verifier — signs Verification Receipts for the demo.
//
// In a real deployment this is a separate agent / service with its own
// keypair and a verifier-routing layer in front. For the demo we keep it
// in-process and produce ed25519-shaped (placeholder) signatures so the
// receipt validates against the schema.
// ─────────────────────────────────────────────────────────────────────────────

import {
  accordHashV0,
  type AccordAgreement,
  type AccordVerificationReceipt,
} from "@accord-protocol/core";
import type { AccordVerifierFn } from "@accord-protocol/mcp";

/**
 * Build a verifier function. Inspects the seller's output against the
 * agreement's evidence_required list; emits an `accepted` receipt when
 * everything checks out, `rejected` when the schema is missing.
 */
export function makeDemoVerifier(): AccordVerifierFn {
  return async ({ agreement, output }) => {
    const checks = runChecks(agreement, output);
    const failed = checks.filter((c) => c.result === "fail");
    return {
      type: "accord.verification_receipt.v0",
      version: "v0",
      receipt_id: "vr_" + makeBase32Id(`${agreement.agreement_id}:${nowIsoUtc()}`),
      agreement_id: agreement.agreement_id,
      agreement_hash: "blake2b256:0x" + accordHashV0(agreement),
      verifier: { id: "verifier://demo-security-v0" },
      result: failed.length === 0 ? "accepted" : "rejected",
      evidence: {
        output_hash: "blake2b256:0x" + accordHashV0(output),
        schema: "accord.audit_report.v0",
      },
      checks,
      created_at: nowIsoUtc(),
      // Placeholder signature — production code would actually sign
      // `signingHashRaw(receipt)` from @accord-protocol/core with a real key.
      signature: {
        scheme: "ed25519",
        public_key: "0x" + "ab".repeat(32),
        signature: "0x" + "cd".repeat(32),
      },
    };
  };
}

function runChecks(
  agreement: AccordAgreement,
  output: unknown,
): { name: string; result: "pass" | "fail" | "skip" | "inconclusive"; detail?: string }[] {
  const checks: { name: string; result: "pass" | "fail"; detail?: string }[] = [];

  const required = agreement.verification.evidence_required ?? [];
  if (required.includes("schema_valid")) {
    const ok =
      typeof output === "object" &&
      output !== null &&
      (output as { schema?: string }).schema === "accord.audit_report.v0";
    checks.push({
      name: "schema_valid",
      result: ok ? "pass" : "fail",
      detail: ok ? undefined : "output.schema != accord.audit_report.v0",
    });
  }
  if (required.includes("severity_present")) {
    const findings = (output as { findings?: { severity?: string }[] }).findings ?? [];
    const hasSeverity = findings.every((f) => typeof f.severity === "string");
    checks.push({
      name: "severity_present",
      result: hasSeverity ? "pass" : "fail",
    });
  }
  return checks;
}

// ── helpers ──────────────────────────────────────────────────────────────────

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

// Suppress unused warning in dev when this file is imported as a side-effect.
export type { AccordVerificationReceipt };
