// ─────────────────────────────────────────────────────────────────────────────
// Seller — paywalled MCP tool, real Ergo testnet rail.
//
// Same wrapAccordMcp shape as example 15. The single line that changes is
// the rail: instead of demoRail (in-process MockPayment), we plug
// createErgoRailAdapter wired to a real ErgoAgentPay instance. That
// instance reads Notes from testnet, validates predicates, and signs the
// redemption transaction when the seller's handler succeeds.
// ─────────────────────────────────────────────────────────────────────────────

import { wrapAccordMcp, describeAccordMcpTool } from "@accord-protocol/mcp"
import type { AccordVerifierFn } from "@accord-protocol/mcp"
import type { AccordRailAdapter } from "@accord-protocol/rails"
import { createErgoRailAdapter } from "@accord-protocol/rails-ergo"
import type { ErgoNoteOps } from "@accord-protocol/rails-ergo"
import type { ErgoAgentPay } from "ergo-agent-pay"
import type { InMemoryAgreementStore } from "../common/storage/agreement-store.js"

export interface AuditFinding {
  severity: "low" | "medium" | "high" | "critical"
  file: string
  line: number
  detail: string
}

export interface AuditReport {
  schema: "accord.audit_report.v0"
  repo_url: string
  findings: AuditFinding[]
}

/**
 * Stand-in for a real repo audit. Looks at the URL, returns deterministic
 * findings. Same fixture as example 15 — the change in 16 is *how* it
 * gets paid, not *what* it does.
 */
function fakeAudit(repo_url: string): AuditReport {
  return {
    schema: "accord.audit_report.v0",
    repo_url,
    findings: [
      {
        severity: "high",
        file: "src/auth/session.ts",
        line: 42,
        detail: "Session token logged in plain text — potential PII leak.",
      },
      {
        severity: "medium",
        file: "src/api/run.ts",
        line: 117,
        detail: "Body parser missing 1 MB ceiling — possible DoS.",
      },
    ],
  }
}

export interface BuildSellerOptions {
  agreementStore: InMemoryAgreementStore
  /** Seller-side ErgoAgentPay — verifies + redeems Notes on testnet. */
  sellerAgent: ErgoAgentPay
  verifier?: AccordVerifierFn
}

export function buildSeller(opts: BuildSellerOptions) {
  // ErgoAgentPay's `network` property is `private` in TypeScript, but
  // ErgoNoteOps requires it to be public-readable. Runtime is compatible
  // (the field exists), TS just refuses the structural match. Cast via
  // `unknown` until ergo-agent-pay v0.5 promotes `network` to `readonly`.
  const ops = opts.sellerAgent as unknown as ErgoNoteOps
  const rail: AccordRailAdapter = createErgoRailAdapter({ ops })

  const callTool = wrapAccordMcp<{ repo_url: string }, AuditReport>({
    rail,
    verifier: opts.verifier,
    resolveAgreement: async (id) => opts.agreementStore.get(id),
    handler: async (args) => fakeAudit(args.repo_url),
  })

  const toolDefinition = describeAccordMcpTool({
    name: "ergo_testnet_repo_audit",
    description:
      "Audit a public GitHub repository for critical security issues. Paid via Accord on Ergo testnet — every call costs 0.001 testnet ERG, settled by Note redemption.",
    inputSchema: {
      type: "object",
      properties: {
        repo_url: { type: "string", description: "GitHub repository URL." },
      },
      required: ["repo_url"],
    },
  })

  return { callTool, toolDefinition }
}
