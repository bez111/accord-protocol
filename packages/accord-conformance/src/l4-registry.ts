// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/conformance — L4 registry-certified checks
//
// "Listed in the public registry with passing conformance."
//
// At v0 the registry is a folder of JSON files (registry/), not a hosted
// service — see registry/README.md. L4 validates that:
//
//   * registry/{providers,verifiers,rails,manifests}/*.json are well-formed
//   * each record carries the expected `type` literal and `version: "v0"`
//   * `registry/revocations.json` is an array (possibly empty)
//   * rail records' `manifest` field points at a manifest file that exists
//     under registry/manifests/
//   * provider records' `accepted_rails[]` only name rails that have a
//     matching record in registry/rails/
//   * conformance.level (when present) is one of L0–L4
//
// L4 is a SUITE-level harness — it validates the registry shape, not the
// truth of any conformance claim. A provider claiming `level: L2` is still
// only verified against the L2 conformance run by them; L4 just checks
// that the claim is well-shaped.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import type { ConformanceCheck, ConformanceLevelResult } from "./types.js";

interface RunL4Options {
  /** Path to the repo containing `registry/`. Defaults to cwd. */
  repoRoot?: string;
}

const VALID_LEVELS = new Set(["L0", "L1", "L2", "L3", "L4"]);
const VALID_RAILS = new Set(["ergo", "rosen", "base", "x402"]);

export async function runL4(opts: RunL4Options = {}): Promise<ConformanceLevelResult> {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const registryDir = path.join(repoRoot, "registry");
  const checks: ConformanceCheck[] = [];

  if (!fs.existsSync(registryDir)) {
    checks.push({
      id: "L4.registry.directory-exists",
      level: "L4",
      description: "registry/ folder exists",
      result: "fail",
      detail: `directory not found at ${registryDir}`,
    });
    return summarise(checks);
  }

  validateRevocations(registryDir, checks);
  const railNames = validateRails(registryDir, checks);
  validateManifests(registryDir, checks);
  validateProviders(registryDir, checks, railNames);
  validateVerifiers(registryDir, checks);

  return summarise(checks);
}

// ── per-record validators ────────────────────────────────────────────────────

function validateRevocations(registryDir: string, checks: ConformanceCheck[]): void {
  const file = path.join(registryDir, "revocations.json");
  const id = "L4.registry.revocations";
  if (!fs.existsSync(file)) {
    checks.push({
      id,
      level: "L4",
      description: "registry/revocations.json exists",
      result: "fail",
      detail: "missing — should be `[]` if no revocations yet",
    });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    checks.push({
      id,
      level: "L4",
      description: "registry/revocations.json parses as JSON",
      result: "fail",
      detail: stringifyError(err),
    });
    return;
  }
  if (!Array.isArray(parsed)) {
    checks.push({
      id,
      level: "L4",
      description: "registry/revocations.json is an array",
      result: "fail",
      detail: `expected array, got ${typeof parsed}`,
    });
    return;
  }
  checks.push({
    id,
    level: "L4",
    description: `registry/revocations.json is a well-formed array (${parsed.length} entries)`,
    result: "pass",
  });
}

function validateRails(
  registryDir: string,
  checks: ConformanceCheck[],
): Set<string> {
  const dir = path.join(registryDir, "rails");
  const names = new Set<string>();
  if (!fs.existsSync(dir)) {
    checks.push({
      id: "L4.registry.rails.directory-exists",
      level: "L4",
      description: "registry/rails/ exists",
      result: "fail",
      detail: "missing",
    });
    return names;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    checks.push({
      id: "L4.registry.rails.has-entries",
      level: "L4",
      description: "registry/rails/ has at least one rail record",
      result: "fail",
      detail: "no rail records — at least one of {ergo,rosen,base,x402} expected",
    });
    return names;
  }
  for (const f of files) {
    const id = `L4.registry.rails.${f.replace(/\.json$/, "")}`;
    const full = path.join(dir, f);
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(fs.readFileSync(full, "utf-8"));
    } catch (err) {
      checks.push({
        id,
        level: "L4",
        description: `${path.relative(registryDir, full)} parses`,
        result: "fail",
        detail: stringifyError(err),
      });
      continue;
    }
    const okType = rec.type === "accord.rail_adapter.v0";
    const okVersion = rec.version === "v0";
    const okRail =
      typeof rec.rail === "string" && VALID_RAILS.has(rec.rail as string);
    const allOk = okType && okVersion && okRail;
    checks.push({
      id,
      level: "L4",
      description: `${path.relative(registryDir, full)} is a valid accord.rail_adapter.v0 record`,
      result: allOk ? "pass" : "fail",
      detail: allOk
        ? undefined
        : `type=${rec.type}, version=${rec.version}, rail=${rec.rail}`,
    });
    if (allOk && typeof rec.rail === "string") names.add(rec.rail);
  }
  return names;
}

function validateManifests(registryDir: string, checks: ConformanceCheck[]): void {
  const dir = path.join(registryDir, "manifests");
  if (!fs.existsSync(dir)) {
    checks.push({
      id: "L4.registry.manifests.directory-exists",
      level: "L4",
      description: "registry/manifests/ exists",
      result: "fail",
      detail: "missing",
    });
    return;
  }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const id = `L4.registry.manifests.${f.replace(/\.json$/, "")}`;
    const full = path.join(dir, f);
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(fs.readFileSync(full, "utf-8"));
    } catch (err) {
      checks.push({
        id,
        level: "L4",
        description: `${path.relative(registryDir, full)} parses`,
        result: "fail",
        detail: stringifyError(err),
      });
      continue;
    }
    const okShape =
      rec.type === "accord.audited_manifest_ref.v0" &&
      rec.version === "v0" &&
      typeof rec.rail === "string" &&
      typeof rec.manifest_path === "string";
    checks.push({
      id,
      level: "L4",
      description: `${path.relative(registryDir, full)} is a valid manifest_ref.v0 record`,
      result: okShape ? "pass" : "fail",
      detail: okShape ? undefined : `record fields incomplete`,
    });
    // Manifest path must resolve from repoRoot.
    if (typeof rec.manifest_path === "string") {
      const repoRoot = path.dirname(registryDir);
      const target = path.join(repoRoot, rec.manifest_path);
      checks.push({
        id: `${id}.path-resolves`,
        level: "L4",
        description: `${path.relative(registryDir, full)}.manifest_path → file exists`,
        result: fs.existsSync(target) ? "pass" : "fail",
        detail: fs.existsSync(target)
          ? undefined
          : `${rec.manifest_path} not found from repo root`,
      });
    }
  }
}

function validateProviders(
  registryDir: string,
  checks: ConformanceCheck[],
  knownRails: Set<string>,
): void {
  const dir = path.join(registryDir, "providers");
  if (!fs.existsSync(dir)) {
    checks.push({
      id: "L4.registry.providers.directory-exists",
      level: "L4",
      description: "registry/providers/ exists",
      result: "fail",
      detail: "missing",
    });
    return;
  }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const id = `L4.registry.providers.${f.replace(/\.json$/, "")}`;
    const full = path.join(dir, f);
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(fs.readFileSync(full, "utf-8"));
    } catch (err) {
      checks.push({
        id,
        level: "L4",
        description: `${path.relative(registryDir, full)} parses`,
        result: "fail",
        detail: stringifyError(err),
      });
      continue;
    }
    const okShape =
      rec.type === "accord.provider_profile.v0" &&
      rec.version === "v0" &&
      typeof rec.provider_id === "string";
    checks.push({
      id,
      level: "L4",
      description: `${path.relative(registryDir, full)} is a valid provider_profile.v0`,
      result: okShape ? "pass" : "fail",
    });
    // accepted_rails ⊆ knownRails
    const acceptedRails = (rec.accepted_rails ?? []) as unknown[];
    if (Array.isArray(acceptedRails) && acceptedRails.length > 0) {
      const unknownRails = acceptedRails.filter(
        (r) => typeof r !== "string" || !knownRails.has(r),
      );
      checks.push({
        id: `${id}.accepted-rails-known`,
        level: "L4",
        description: `accepted_rails ⊆ registered rails`,
        result: unknownRails.length === 0 ? "pass" : "fail",
        detail:
          unknownRails.length === 0
            ? undefined
            : `unknown rails: ${unknownRails.join(", ")}`,
      });
    }
    // conformance.level ∈ L0–L4
    const conformance = rec.conformance as { level?: string } | undefined;
    if (conformance && conformance.level !== undefined) {
      checks.push({
        id: `${id}.conformance-level-valid`,
        level: "L4",
        description: `conformance.level ∈ {L0, L1, L2, L3, L4}`,
        result: VALID_LEVELS.has(conformance.level) ? "pass" : "fail",
        detail: VALID_LEVELS.has(conformance.level)
          ? undefined
          : `got ${conformance.level}`,
      });
    }
  }
}

function validateVerifiers(registryDir: string, checks: ConformanceCheck[]): void {
  const dir = path.join(registryDir, "verifiers");
  if (!fs.existsSync(dir)) {
    checks.push({
      id: "L4.registry.verifiers.directory-exists",
      level: "L4",
      description: "registry/verifiers/ exists",
      result: "fail",
      detail: "missing",
    });
    return;
  }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const id = `L4.registry.verifiers.${f.replace(/\.json$/, "")}`;
    const full = path.join(dir, f);
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(fs.readFileSync(full, "utf-8"));
    } catch (err) {
      checks.push({
        id,
        level: "L4",
        description: `${path.relative(registryDir, full)} parses`,
        result: "fail",
        detail: stringifyError(err),
      });
      continue;
    }
    const okShape =
      rec.type === "accord.verifier_profile.v0" &&
      rec.version === "v0" &&
      typeof rec.verifier_id === "string";
    checks.push({
      id,
      level: "L4",
      description: `${path.relative(registryDir, full)} is a valid verifier_profile.v0`,
      result: okShape ? "pass" : "fail",
    });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function summarise(checks: ConformanceCheck[]): ConformanceLevelResult {
  return {
    level: "L4",
    passed: checks.every((c) => c.result === "pass") && checks.length > 0,
    passed_count: checks.filter((c) => c.result === "pass").length,
    failed_count: checks.filter((c) => c.result === "fail").length,
    inconclusive_count: checks.filter((c) => c.result === "inconclusive").length,
    checks,
  };
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
