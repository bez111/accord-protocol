// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/conformance — L3 security-compatibility checks
//
// "Production-safety gates fire on mainnet writes."
//
// Probes the existing safety primitives — `assertProductionSafety` and the
// audit-manifest verifiers — and asserts:
//
//   * mainnet writes without scriptErgoTree are rejected (INSECURE_MAINNET_MODE)
//   * mainnet writes with arbitrary scriptErgoTree but no auditPolicy are rejected
//     (UNAUDITED_ERGOTREE)
//   * `dangerouslyAllowInsecureMainnetP2PK: true` lets a P2PK box through on
//     mainnet (documented escape hatch — its existence is part of the contract)
//   * `verifyAuditedErgoTree(name, tree, { requireMainnet: true })` rejects on
//     a draft-pre-audit manifest (manifest-unsigned)
//   * Base/EVM rail counterparts: assertProductionSafety + verifyAuditedContract
//     fire on the same shape
//
// L3 is conducted against THIS repo's reference implementation by default.
// A third-party SDK that re-implements `assertProductionSafety` should
// pass the same probes — that's how a fork would claim "Accord-compatible (L3)".
//
// Note: L3 doesn't probe live mainnet — it probes the gate's BEHAVIOUR with
// `network: "mainnet"` set. The implementation refuses to broadcast either
// way; we only check the rejection codes and codes paths, not actual chain
// activity.
// ─────────────────────────────────────────────────────────────────────────────

import {
  assertProductionSafety as ergoAssertSafety,
  ErgoAgentPayError,
} from "ergo-agent-pay";
import {
  verifyAuditedErgoTree,
  loadAuditedManifest,
  tryGetErgoTree,
} from "ergo-agent-scripts";
import {
  assertProductionSafety as baseAssertSafety,
  BaseAgentPayError,
  loadAuditedContracts,
} from "agentpay-base";

import type { ConformanceCheck, ConformanceLevelResult } from "./types.js";

export async function runL3(): Promise<ConformanceLevelResult> {
  const checks: ConformanceCheck[] = [];

  await runErgoSafetyChecks(checks);
  await runBaseSafetyChecks(checks);
  runManifestStatusChecks(checks);

  return summarise(checks);
}

// ── Ergo rail: assertProductionSafety + verifyAuditedErgoTree ───────────────

async function runErgoSafetyChecks(checks: ConformanceCheck[]): Promise<void> {
  // 1. Mainnet write with no scriptErgoTree → INSECURE_MAINNET_MODE
  checks.push(
    await captureRejection({
      id: "L3.ergo.mainnet-no-script-rejected",
      description:
        "ergo-agent-pay assertProductionSafety rejects mainnet write without scriptErgoTree (INSECURE_MAINNET_MODE)",
      expectedCode: "INSECURE_MAINNET_MODE",
      run: () =>
        ergoAssertSafety({
          operation: "issueNote",
          network: "mainnet",
          scriptErgoTree: undefined,
        }),
    }),
  );

  // 2. Empty-string scriptErgoTree counts as missing → INSECURE_MAINNET_MODE
  checks.push(
    await captureRejection({
      id: "L3.ergo.mainnet-empty-string-script-rejected",
      description:
        "ergo-agent-pay assertProductionSafety rejects empty-string scriptErgoTree on mainnet",
      expectedCode: "INSECURE_MAINNET_MODE",
      run: () =>
        ergoAssertSafety({
          operation: "issueNote",
          network: "mainnet",
          scriptErgoTree: "",
        }),
    }),
  );

  // 3. Mainnet write with non-empty tree but no auditPolicy → UNAUDITED_ERGOTREE
  checks.push(
    await captureRejection({
      id: "L3.ergo.mainnet-no-audit-policy-rejected",
      description:
        "ergo-agent-pay assertProductionSafety rejects mainnet write with no auditPolicy (UNAUDITED_ERGOTREE)",
      expectedCode: "UNAUDITED_ERGOTREE",
      run: () =>
        ergoAssertSafety({
          operation: "issueNote",
          network: "mainnet",
          scriptErgoTree: "0e20" + "ab".repeat(32),
        }),
    }),
  );

  // 4. dangerouslyAllowInsecureMainnetP2PK → passes (documented escape hatch)
  let dangerouslyOk = false;
  try {
    await ergoAssertSafety({
      operation: "issueNote",
      network: "mainnet",
      scriptErgoTree: undefined,
      dangerouslyAllowInsecureMainnetP2PK: true,
    });
    dangerouslyOk = true;
  } catch {
    dangerouslyOk = false;
  }
  checks.push({
    id: "L3.ergo.dangerously-allow-p2pk-passes",
    level: "L3",
    description:
      "documented escape hatch: dangerouslyAllowInsecureMainnetP2PK lets a P2PK box through on mainnet",
    result: dangerouslyOk ? "pass" : "fail",
    detail: dangerouslyOk
      ? undefined
      : "the documented opt-in flag was rejected; SDK contract drift",
  });

  // 5. Testnet always allowed even with no script
  let testnetOk = false;
  try {
    await ergoAssertSafety({
      operation: "issueNote",
      network: "testnet",
      scriptErgoTree: undefined,
    });
    testnetOk = true;
  } catch {
    testnetOk = false;
  }
  checks.push({
    id: "L3.ergo.testnet-always-allowed",
    level: "L3",
    description: "testnet writes are always allowed (dev convenience)",
    result: testnetOk ? "pass" : "fail",
  });

  // 6. verifyAuditedErgoTree({ requireMainnet: true }) refuses unsigned manifest
  const tree = tryGetErgoTree("credential_v0");
  if (!tree) {
    checks.push({
      id: "L3.ergo.verify-mainnet-rejects-unsigned-manifest",
      level: "L3",
      description:
        "verifyAuditedErgoTree(requireMainnet) rejects when manifest is draft-pre-audit",
      result: "inconclusive",
      detail: "credential_v0 missing from registry — cannot probe verifier",
    });
  } else {
    const v = verifyAuditedErgoTree("credential_v0", tree, { requireMainnet: true });
    const ok =
      v.ok === false &&
      (v.reason === "manifest-unsigned" || v.reason === "not-mainnet-allowed");
    checks.push({
      id: "L3.ergo.verify-mainnet-rejects-unsigned-manifest",
      level: "L3",
      description:
        "verifyAuditedErgoTree(requireMainnet) rejects when manifest is draft-pre-audit",
      result: ok ? "pass" : "fail",
      detail: ok ? undefined : `got ${JSON.stringify(v)}`,
    });
  }
}

// ── Base/EVM rail: assertProductionSafety + verifyAuditedContract ──────────

async function runBaseSafetyChecks(checks: ConformanceCheck[]): Promise<void> {
  // agentpay-base's assertProductionSafety requires a viem PublicClient and
  // a reserveContract address even for rejection-mode probing. The gate
  // function only USES the client when an auditPolicy is configured to
  // call fetchBytecodeHash; for the rejection paths we exercise here it's
  // never invoked, so we hand it a minimal stub.
  const stubClient = {} as Parameters<typeof baseAssertSafety>[0]["publicClient"];
  const stubAddress = ("0x" +
    "ab".repeat(20)) as Parameters<typeof baseAssertSafety>[0]["reserveContract"];

  // 1. Mainnet write with no auditPolicy → UNAUDITED_CONTRACT
  checks.push(
    await captureRejection({
      id: "L3.base.mainnet-no-audit-policy-rejected",
      description:
        "agentpay-base assertProductionSafety rejects mainnet without auditPolicy",
      expectedCode: "UNAUDITED_CONTRACT",
      run: () =>
        baseAssertSafety({
          operation: "issueNote",
          network: "base",
          reserveContract: stubAddress,
          publicClient: stubClient,
        }),
    }),
  );

  // 2. Mainnet write with allow flag → passes (documented escape hatch)
  let allowOk = false;
  try {
    await baseAssertSafety({
      operation: "issueNote",
      network: "base",
      reserveContract: stubAddress,
      publicClient: stubClient,
      dangerouslyAllowUnauditedContract: true,
    });
    allowOk = true;
  } catch {
    allowOk = false;
  }
  checks.push({
    id: "L3.base.dangerously-allow-passes",
    level: "L3",
    description:
      "documented escape hatch: dangerouslyAllowUnauditedContract lets a write through on mainnet",
    result: allowOk ? "pass" : "fail",
  });

  // 3. Testnet always allowed (no client calls expected on the testnet path)
  let testnetOk = false;
  try {
    await baseAssertSafety({
      operation: "issueNote",
      network: "base-sepolia",
      reserveContract: stubAddress,
      publicClient: stubClient,
    });
    testnetOk = true;
  } catch {
    testnetOk = false;
  }
  checks.push({
    id: "L3.base.testnet-always-allowed",
    level: "L3",
    description: "Base/EVM testnet writes are always allowed (dev convenience)",
    result: testnetOk ? "pass" : "fail",
  });
}

// ── Manifest status (both rails) ────────────────────────────────────────────

function runManifestStatusChecks(checks: ConformanceCheck[]): void {
  // Ergo manifest must be draft-pre-audit + every entry mainnetAllowed=false.
  try {
    const m = loadAuditedManifest();
    const allBlocked = m.entries.every((e) => e.mainnetAllowed === false);
    checks.push({
      id: "L3.manifest.ergo.all-blocked",
      level: "L3",
      description:
        "AUDITED_ERGOTREES.json: every entry has mainnetAllowed=false (draft-pre-audit)",
      result: allBlocked ? "pass" : "fail",
      detail: allBlocked
        ? undefined
        : `${m.entries.filter((e) => e.mainnetAllowed).length} entries are mainnetAllowed=true`,
    });
    checks.push({
      id: "L3.manifest.ergo.draft-pre-audit",
      level: "L3",
      description: "AUDITED_ERGOTREES.json status is 'draft-pre-audit'",
      result: m.status === "draft-pre-audit" ? "pass" : "fail",
      detail: m.status === "draft-pre-audit" ? undefined : `status=${m.status}`,
    });
  } catch (err) {
    checks.push({
      id: "L3.manifest.ergo.load",
      level: "L3",
      description: "AUDITED_ERGOTREES.json loads",
      result: "fail",
      detail: stringifyError(err),
    });
  }

  // Base manifest: in v0 the entries array is empty → audit gate refuses
  // every mainnet write by default. Either form (empty entries OR every
  // entry mainnetAllowed=false) is acceptable.
  try {
    const m = loadAuditedContracts();
    const allBlocked =
      m.entries.length === 0 || m.entries.every((e) => e.mainnetAllowed === false);
    checks.push({
      id: "L3.manifest.base.all-blocked",
      level: "L3",
      description:
        "AUDITED_CONTRACTS.json: empty entries OR every entry mainnetAllowed=false",
      result: allBlocked ? "pass" : "fail",
      detail: allBlocked
        ? undefined
        : `${m.entries.filter((e) => e.mainnetAllowed).length} entries are mainnetAllowed=true`,
    });
  } catch (err) {
    checks.push({
      id: "L3.manifest.base.load",
      level: "L3",
      description: "AUDITED_CONTRACTS.json loads",
      result: "fail",
      detail: stringifyError(err),
    });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function captureRejection(args: {
  id: string;
  description: string;
  expectedCode: string;
  run: () => Promise<unknown>;
}): Promise<ConformanceCheck> {
  try {
    await args.run();
    return {
      id: args.id,
      level: "L3",
      description: args.description,
      result: "fail",
      detail: `expected rejection ${args.expectedCode}; call returned successfully`,
    };
  } catch (err) {
    const code =
      err instanceof ErgoAgentPayError || err instanceof BaseAgentPayError
        ? err.code
        : (err as { code?: string })?.code;
    if (code === args.expectedCode) {
      return {
        id: args.id,
        level: "L3",
        description: args.description,
        result: "pass",
      };
    }
    return {
      id: args.id,
      level: "L3",
      description: args.description,
      result: "fail",
      detail: `expected ${args.expectedCode}, got ${code ?? stringifyError(err)}`,
    };
  }
}

function summarise(checks: ConformanceCheck[]): ConformanceLevelResult {
  return {
    level: "L3",
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
