// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-pay — Production Safety Guardrails
//
// Lifecycle operations on mainnet must satisfy *two* gates:
//
//   1. **Box-shape gate.** A compiled `scriptErgoTree` is supplied.
//   2. **Audit gate.** The supplied tree is approved by an `AuditPolicy`
//      (typically backed by `ergo-agent-scripts/AUDITED_ERGOTREES.json`).
//
// There is deliberately no mainnet bypass. The legacy `dangerously*` flags
// are still accepted by the type surface for compatibility, but on mainnet
// they fail closed. Testnet stays a friendly dev env.
//
// ─────────────────────────────────────────────────────────────────────────────

import type { Network } from "./types.js";
import { ErgoAgentPayError } from "./types.js";

/**
 * Audit-policy callback. Returns `{ ok: true }` to approve, or
 * `{ ok: false, reason }` to reject. The SDK never reads ergo-agent-scripts
 * directly — integrators wire the policy explicitly so the SDK stays
 * decoupled.
 *
 * Typical use:
 * ```ts
 * import { verifyAuditedErgoTree } from "ergo-agent-scripts"
 *
 * new ErgoAgentPay({
 *   ...,
 *   auditPolicy: (tree, name) => {
 *     if (!name) return { ok: false, reason: "audit-policy requires a tree name" }
 *     const v = verifyAuditedErgoTree(name, tree, { requireMainnet: true })
 *     return v.ok ? { ok: true } : { ok: false, reason: v.message ?? v.reason ?? "unaudited" }
 *   },
 * })
 * ```
 */
export type AuditPolicy = (
  treeHex: string,
  name?: string
) => AuditPolicyVerdict | Promise<AuditPolicyVerdict>;

export type AuditPolicyVerdict = { ok: true } | { ok: false; reason: string };

export interface ProductionSafetyArgs {
  /** Operation name shown in the error message. */
  operation: "createReserve" | "issueNote" | "deployTracker";

  /** The active network. */
  network: Network;

  /** Compiled ErgoTree for the box's spending condition, or undefined. */
  scriptErgoTree: string | undefined;

  /**
   * Optional name of the audited predicate this tree is supposed to be
   * (e.g. `"credential_v0"`). When set, the audit policy uses it to look
   * up the canonical tree and compare byte-for-byte.
   */
  scriptName?: string;

  /** @deprecated No longer bypasses mainnet safety; rejected on mainnet. */
  dangerouslyAllowInsecureMainnetP2PK?: boolean;

  /**
   * @deprecated No longer bypasses mainnet safety; rejected on mainnet.
   * Testnet ignores this flag.
   */
  dangerouslyAllowUnauditedErgoTree?: boolean;

  /** Audit-policy callback. See `AuditPolicy`. */
  auditPolicy?: AuditPolicy;

  /**
   * @deprecated No longer bypasses mainnet safety; rejected on mainnet.
   */
  allowInsecureDevMode?: boolean;
}

/**
 * Throws unless the operation is safe to execute under the current config.
 * See module header for the rule chain.
 */
export async function assertProductionSafety(args: ProductionSafetyArgs): Promise<void> {
  const { operation, network, scriptErgoTree, scriptName } = args;

  if (network !== "mainnet") return;

  if (
    args.dangerouslyAllowInsecureMainnetP2PK === true ||
    args.allowInsecureDevMode === true
  ) {
    throw new ErgoAgentPayError(
      `Refusing to ${operation} on mainnet — insecure P2PK mainnet bypass ` +
        `flags are disabled. Supply a compiled, audited scriptErgoTree instead.`,
      "INSECURE_MAINNET_MODE"
    );
  }

  if (args.dangerouslyAllowUnauditedErgoTree === true) {
    throw new ErgoAgentPayError(
      `Refusing to ${operation} on mainnet — unaudited ErgoTree bypass flags ` +
        `are disabled. Configure auditPolicy with a signed manifest entry marked ` +
        `mainnetAllowed: true.`,
      "UNAUDITED_ERGOTREE"
    );
  }

  // ── Gate 1: box-shape ─────────────────────────────────────────────────────
  const hasTree = !!scriptErgoTree && scriptErgoTree.length > 0;
  if (!hasTree) {
    throw new ErgoAgentPayError(
      `Refusing to ${operation} on mainnet without a compiled ErgoTree script.\n` +
        `Without scriptErgoTree the resulting box is plain P2PK and any acceptance\n` +
        `predicate stored in R6/R7 is NOT enforced on-chain. Supply a compiled,\n` +
        `audited scriptErgoTree before using mainnet.\n` +
        `See SECURITY.md and SPEC.md.`,
      "INSECURE_MAINNET_MODE"
    );
  }

  // ── Gate 2: audit ────────────────────────────────────────────────────────
  if (args.auditPolicy) {
    let verdict: AuditPolicyVerdict;
    try {
      verdict = await args.auditPolicy(scriptErgoTree!, scriptName);
    } catch (err) {
      // M-004: a buggy auditPolicy must not leak its raw exception. Convert
      // to a typed UNAUDITED_ERGOTREE error so the caller observes the same
      // failure mode as a returned `{ ok: false }`.
      const reason =
        err instanceof Error ? err.message : String(err ?? "unknown error");
      throw new ErgoAgentPayError(
        `Refusing to ${operation} on mainnet — auditPolicy threw while ` +
          `evaluating the supplied ergoTree. Treating as unaudited.\n` +
          `Reason: ${reason}`,
        "UNAUDITED_ERGOTREE",
        err
      );
    }
    if (verdict.ok) return;
    throw new ErgoAgentPayError(
      `Refusing to ${operation} on mainnet — audit policy rejected the supplied ergoTree.\n` +
        `Reason: ${verdict.reason}\n` +
        `Supply a tree present in your externally signed audited manifest as ` +
        `mainnetAllowed: true.`,
      "UNAUDITED_ERGOTREE"
    );
  }

  throw new ErgoAgentPayError(
    `Refusing to ${operation} on mainnet — no auditPolicy is configured.\n` +
      `Mainnet writes require an audited ergoTree. Configure auditPolicy on\n` +
      `the agent, typically backed by \`verifyAuditedErgoTree\` from\n` +
      `ergo-agent-scripts with requireMainnet: true.\n` +
      `See SECURITY.md.`,
    "UNAUDITED_ERGOTREE"
  );
}
