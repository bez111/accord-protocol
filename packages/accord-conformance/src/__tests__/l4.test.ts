import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runConformance, runL4 } from "../index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

describe("conformance L4 — registry-certified", () => {
  it("passes against this repo's registry/", async () => {
    const result = await runL4({ repoRoot: REPO_ROOT });
    const fails = result.checks.filter((c) => c.result !== "pass");
    assert.equal(
      result.passed,
      true,
      `L4 unexpectedly failed:\n${fails
        .map((c) => `  ${c.id} ${c.result}: ${c.detail}`)
        .join("\n")}`,
    );
  });

  it("validates each registry sub-folder", async () => {
    const result = await runL4({ repoRoot: REPO_ROOT });
    const ids = result.checks.map((c) => c.id);
    assert.ok(ids.some((id) => id.startsWith("L4.registry.providers.")));
    assert.ok(ids.some((id) => id.startsWith("L4.registry.verifiers.")));
    assert.ok(ids.some((id) => id.startsWith("L4.registry.rails.")));
    assert.ok(ids.some((id) => id.startsWith("L4.registry.manifests.")));
    assert.ok(ids.some((id) => id === "L4.registry.revocations"));
  });

  it("manifest-path resolution checks pass for the four reference rails' manifests", async () => {
    const result = await runL4({ repoRoot: REPO_ROOT });
    const pathChecks = result.checks.filter((c) =>
      c.id.endsWith(".path-resolves"),
    );
    assert.ok(pathChecks.length >= 1);
    for (const c of pathChecks) {
      assert.equal(c.result, "pass", `${c.id}: ${c.detail}`);
    }
  });

  it("achieved_level reports L4 when all 5 levels pass", async () => {
    const result = await runConformance({
      repoRoot: REPO_ROOT,
      levels: ["L0", "L1", "L2", "L3", "L4"],
    });
    assert.equal(result.achieved_level, "L4");
  });
});
