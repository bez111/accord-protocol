// ─────────────────────────────────────────────────────────────────────────────
// Seller — paywalled MCP tool. Wraps a fake repo-audit handler with
// @accord-protocol/mcp's wrapAccordMcp, plugs the demo Mock rail and the
// in-process agreement store. Returns AccordMcpResult on every call.
// ─────────────────────────────────────────────────────────────────────────────

import { wrapAccordMcp, describeAccordMcpTool } from "@accord-protocol/mcp";
import { demoRail } from "../common/mock-rail.js";
import type { InMemoryAgreementStore } from "../common/storage/agreement-store.js";
import type { AccordVerifierFn } from "@accord-protocol/mcp";

export interface AuditFinding {
  severity: "low" | "medium" | "high" | "critical";
  file: string;
  line: number;
  detail: string;
}

export interface AuditReport {
  schema: "accord.audit_report.v0";
  repo_url: string;
  findings: AuditFinding[];
}

/** Stand-in for a real repo audit. Looks at the URL, returns deterministic findings. */
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
  };
}

export interface BuildSellerOptions {
  agreementStore: InMemoryAgreementStore;
  verifier?: AccordVerifierFn;
}

/** Build the seller's paywalled MCP tool. */
export function buildSeller(opts: BuildSellerOptions) {
  const callTool = wrapAccordMcp<{ repo_url: string }, AuditReport>({
    rail: demoRail,
    verifier: opts.verifier,
    resolveAgreement: async (id) => opts.agreementStore.get(id),
    handler: async (args) => fakeAudit(args.repo_url),
  });

  const toolDefinition = describeAccordMcpTool({
    name: "demo_repo_audit",
    description:
      "Audit a public GitHub repository for critical security issues. Paid via Accord — every call costs 0.001 ERG (mock).",
    inputSchema: {
      type: "object",
      properties: {
        repo_url: { type: "string", description: "GitHub repository URL." },
      },
      required: ["repo_url"],
    },
  });

  return { callTool, toolDefinition };
}
