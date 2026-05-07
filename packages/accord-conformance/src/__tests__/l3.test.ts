import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runConformance, runL3 } from "../index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

describe("conformance L3 — security-compatibility", () => {
  it("passes against this repo's reference implementations", async () => {
    const result = await runL3();
    const fails = result.checks.filter((c) => c.result !== "pass");
    assert.equal(
      result.passed,
      true,
      `L3 unexpectedly failed:\n${fails
        .map((c) => `  ${c.id} ${c.result}: ${c.detail}`)
        .join("\n")}`,
    );
    assert.ok(result.passed_count >= 10, `expected ≥10 checks, got ${result.passed_count}`);
  });

  it("includes Ergo + Base safety probes + manifest status", async () => {
    const result = await runL3();
    const ids = result.checks.map((c) => c.id);
    assert.ok(ids.some((id) => id.startsWith("L3.ergo.")));
    assert.ok(ids.some((id) => id.startsWith("L3.base.")));
    assert.ok(ids.some((id) => id.startsWith("L3.manifest.ergo.")));
    assert.ok(ids.some((id) => id.startsWith("L3.manifest.base.")));
  });

  it("specifically asserts the rejection codes", async () => {
    const result = await runL3();
    const ergoNoScript = result.checks.find(
      (c) => c.id === "L3.ergo.mainnet-no-script-rejected",
    );
    const ergoNoAudit = result.checks.find(
      (c) => c.id === "L3.ergo.mainnet-no-audit-policy-rejected",
    );
    const baseNoAudit = result.checks.find(
      (c) => c.id === "L3.base.mainnet-no-audit-policy-rejected",
    );
    assert.equal(ergoNoScript?.result, "pass", ergoNoScript?.detail);
    assert.equal(ergoNoAudit?.result, "pass", ergoNoAudit?.detail);
    assert.equal(baseNoAudit?.result, "pass", baseNoAudit?.detail);
  });

  it("achieved_level reports L3 when L0+L1+L2+L3 all pass", async () => {
    const result = await runConformance({
      repoRoot: REPO_ROOT,
      levels: ["L0", "L1", "L2", "L3"],
    });
    assert.equal(result.achieved_level, "L3");
  });
});
