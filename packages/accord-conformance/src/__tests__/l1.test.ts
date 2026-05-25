import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runConformance, runL1 } from "../index.js";

describe("conformance L1 — transport-compatibility", () => {
  it("passes against the in-process accord-mcp + accord-gateway implementations", async () => {
    const result = await runL1();
    const fails = result.checks.filter((c) => c.result !== "pass");
    assert.equal(
      result.passed,
      true,
      `L1 unexpectedly failed:\n${fails
        .map((c) => `  ${c.id} ${c.result}: ${c.detail}`)
        .join("\n")}`,
    );
    assert.ok(result.passed_count >= 8, `expected ≥8 checks, got ${result.passed_count}`);
  });

  it("includes both MCP and gateway transports in the same run", async () => {
    const result = await runL1();
    const ids = new Set(result.checks.map((c) => c.id));
    const hasMcp = [...ids].some((id) => id.startsWith("L1.mcp."));
    const hasGw = [...ids].some((id) => id.startsWith("L1.gateway."));
    assert.equal(hasMcp, true);
    assert.equal(hasGw, true);
  });

  it("achieved_level reports L1 when L0 + L1 both pass", async () => {
    const REPO_ROOT = (await import("node:path")).resolve(
      import.meta.dirname,
      "../../../..",
    );
    const result = await runConformance({ repoRoot: REPO_ROOT, levels: ["L0", "L1"] });
    assert.equal(result.achieved_level, "L1");
  });

  it("L1 passes assert receipts validate via core", async () => {
    const result = await runL1();
    const validatorChecks = result.checks.filter((c) =>
      c.id.endsWith(".verification-receipt-valid")
        || c.id.endsWith(".settlement-receipt-valid"),
    );
    assert.ok(validatorChecks.length >= 2);
    for (const c of validatorChecks) {
      assert.equal(c.result, "pass", `${c.id}: ${c.detail}`);
    }
  });

  it("L1 includes a replay-protection check", async () => {
    const result = await runL1();
    const replay = result.checks.find((c) => c.id === "L1.gateway.replay-detected");
    assert.equal(replay?.result, "pass");
  });

  it("L1 includes gateway rail-binding and settlement-omission checks", async () => {
    const result = await runL1();
    const rail = result.checks.find((c) => c.id === "L1.gateway.rail-mismatch-rejected");
    const settlement = result.checks.find(
      (c) => c.id === "L1.gateway.invalid-settlement-omitted",
    );
    assert.equal(rail?.result, "pass", rail?.detail);
    assert.equal(settlement?.result, "pass", settlement?.detail);
  });
});
