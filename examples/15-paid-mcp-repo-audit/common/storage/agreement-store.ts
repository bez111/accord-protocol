// ─────────────────────────────────────────────────────────────────────────────
// 15-paid-mcp-repo-audit — in-memory agreement storage
//
// The seller's MCP wrapper resolves agreement_id → AccordAgreement via this
// store. Real deployments back this with Postgres / Redis / a registry; the
// demo keeps it in-process.
// ─────────────────────────────────────────────────────────────────────────────

import type { AccordAgreement } from "@accord-protocol/core";

export class InMemoryAgreementStore {
  private readonly map = new Map<string, AccordAgreement>();

  put(a: AccordAgreement): void {
    this.map.set(a.agreement_id, a);
  }
  get(id: string): AccordAgreement | undefined {
    return this.map.get(id);
  }
  size(): number {
    return this.map.size;
  }
}
