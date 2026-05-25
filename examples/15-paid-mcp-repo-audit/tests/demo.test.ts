import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runDemo } from "../buyer/run.js";

describe("paid-MCP repo-audit demo", () => {
  it("completes the Accord lifecycle and emits both receipts", async () => {
    const trace = await runDemo({ repo_url: "https://github.com/example/repo" });
    assert.equal(trace.ok, true, JSON.stringify(trace));
    assert.match(trace.agreement_id, /^acc_/);
    assert.match(trace.agreement_hash, /^blake2b256:0x[0-9a-f]{64}$/);
    assert.match(trace.verification_receipt_id ?? "", /^vr_/);
    assert.match(trace.settlement_receipt_id ?? "", /^sr_/);
  });

  it("the seller's handler returned a structured AuditReport", async () => {
    const trace = await runDemo();
    const report = trace.output as { schema?: string; findings?: unknown[] };
    assert.equal(report.schema, "accord.audit_report.v0");
    assert.ok(Array.isArray(report.findings));
    assert.ok((report.findings ?? []).length >= 1);
  });

  it("uses a unique agreement per call", async () => {
    const a = await runDemo({ agreement_id: "acc_01HX0DEMOAAAAAAAAAAAAAAAAA" });
    const b = await runDemo({ agreement_id: "acc_01HX0DEMOBBBBBBBBBBBBBBBBB" });
    assert.notEqual(a.agreement_id, b.agreement_id);
    assert.notEqual(a.agreement_hash, b.agreement_hash);
  });
});
