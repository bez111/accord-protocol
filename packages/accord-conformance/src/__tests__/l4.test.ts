import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runConformance, runL4 } from "../index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRegistryFixture(mutator?: (root: string) => void): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "accord-l4-"));
  const registry = path.join(root, "registry");
  fs.mkdirSync(path.join(registry, "providers"), { recursive: true });
  fs.mkdirSync(path.join(registry, "verifiers"), { recursive: true });
  fs.mkdirSync(path.join(registry, "rails"), { recursive: true });
  fs.mkdirSync(path.join(registry, "manifests"), { recursive: true });

  writeJson(path.join(registry, "revocations.json"), []);
  writeJson(path.join(root, "dummy-manifest.json"), { ok: true });
  writeJson(path.join(registry, "rails", "ergo.json"), {
    type: "accord.rail_adapter.v0",
    version: "v0",
    rail: "ergo",
    manifest: "manifests/ergo.json",
  });
  writeJson(path.join(registry, "manifests", "ergo.json"), {
    type: "accord.audited_manifest_ref.v0",
    version: "v0",
    rail: "ergo",
    manifest_path: "dummy-manifest.json",
  });
  writeJson(path.join(registry, "providers", "example.json"), {
    type: "accord.provider_profile.v0",
    version: "v0",
    provider_id: "provider://example",
    accepted_rails: ["ergo"],
    conformance: { level: "L1" },
  });
  writeJson(path.join(registry, "verifiers", "example.json"), {
    type: "accord.verifier_profile.v0",
    version: "v0",
    verifier_id: "verifier://example",
  });

  mutator?.(root);
  return root;
}

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

  it("fails when a provider names an unregistered rail", async () => {
    const root = makeRegistryFixture((fixtureRoot) => {
      writeJson(path.join(fixtureRoot, "registry", "providers", "example.json"), {
        type: "accord.provider_profile.v0",
        version: "v0",
        provider_id: "provider://example",
        accepted_rails: ["ergo", "unknown-rail"],
        conformance: { level: "L1" },
      });
    });
    const result = await runL4({ repoRoot: root });
    const check = result.checks.find((c) =>
      c.id.endsWith(".accepted-rails-known"),
    );
    assert.equal(result.passed, false);
    assert.equal(check?.result, "fail");
    assert.match(check?.detail ?? "", /unknown-rail/);
  });

  it("fails when a provider claims an invalid conformance level", async () => {
    const root = makeRegistryFixture((fixtureRoot) => {
      writeJson(path.join(fixtureRoot, "registry", "providers", "example.json"), {
        type: "accord.provider_profile.v0",
        version: "v0",
        provider_id: "provider://example",
        accepted_rails: ["ergo"],
        conformance: { level: "L9" },
      });
    });
    const result = await runL4({ repoRoot: root });
    const check = result.checks.find((c) =>
      c.id.endsWith(".conformance-level-valid"),
    );
    assert.equal(result.passed, false);
    assert.equal(check?.result, "fail");
    assert.match(check?.detail ?? "", /L9/);
  });

  it("fails when a registry manifest pointer does not resolve", async () => {
    const root = makeRegistryFixture((fixtureRoot) => {
      writeJson(path.join(fixtureRoot, "registry", "manifests", "ergo.json"), {
        type: "accord.audited_manifest_ref.v0",
        version: "v0",
        rail: "ergo",
        manifest_path: "missing-manifest.json",
      });
    });
    const result = await runL4({ repoRoot: root });
    const check = result.checks.find((c) => c.id.endsWith(".path-resolves"));
    assert.equal(result.passed, false);
    assert.equal(check?.result, "fail");
    assert.match(check?.detail ?? "", /missing-manifest/);
  });

  it("achieved_level reports L4 when all 5 levels pass", async () => {
    const result = await runConformance({
      repoRoot: REPO_ROOT,
      levels: ["L0", "L1", "L2", "L3", "L4"],
    });
    assert.equal(result.achieved_level, "L4");
  });
});
