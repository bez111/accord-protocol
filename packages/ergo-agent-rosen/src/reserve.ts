// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-rosen — Reserve / Note helpers for Rosen-bridged tokens
//
// Wraps `agent.createReserve` and `agent.issueNote` so an integrator can say
// "issue a Note for 5 rsUSDT" without manually wiring tokenIds, the
// manifest-gated `basis_token_reserve_v0` ergoTree, or the audit-policy hooks.
//
// The compiled tree is the same `basis_token_reserve_v0` shipped in
// `ergo-agent-scripts` — only the bound tokenId differs per asset. The
// audit gate sees `scriptName: "basis_token_reserve_v0"` and consults the
// manifest as usual.
// ─────────────────────────────────────────────────────────────────────────────

import type { ErgoAgentPay, ReserveConfig, NoteOptions } from "ergo-agent-pay";
import { tryGetErgoTree } from "ergo-agent-scripts";
import type { TokenLookupResult } from "./types.js";
import { RosenIntegrationError } from "./types.js";

/** The manifest predicate name used for token-collateralised Reserves. */
export const RS_RESERVE_SCRIPT_NAME = "basis_token_reserve_v0" as const;

/**
 * Build a `ReserveConfig` for a Rosen-bridged token reserve.
 *
 * The caller supplies the `TokenLookupResult` (typically obtained from
 * `resolveErgoSideToken(...)`). The Reserve will hold `collateral` units
 * of the bridged token (rsUSDT, rsBTC, …) and back Notes denominated in
 * the same token.
 */
export function buildRosenReserveConfig(args: {
  /** Resolved Ergo-side token (from `resolveErgoSideToken`). */
  token: TokenLookupResult;
  /** Collateral amount in nanoERG (or "N ERG"); minimum box value covers the box itself. */
  collateral: bigint | string | number;
  /** Optional UTF-8 memo stored in R4. */
  memo?: string;
}): ReserveConfig {
  const tree = tryGetErgoTree(RS_RESERVE_SCRIPT_NAME);
  if (!tree) {
    throw new RosenIntegrationError(
      "ergo-agent-scripts has no compiled basis_token_reserve_v0 tree. Run " +
        "`npm run compile-predicates` in that package, or upgrade.",
      "MISSING_TOKEN_MAP"
    );
  }

  const memo = args.memo
    ? `${args.memo} | rosen:${args.token.ergoTokenId.slice(0, 16)}`
    : `rosen:${args.token.ergoTokenId.slice(0, 16)}`;

  return {
    collateral: args.collateral,
    scriptErgoTree: tree,
    scriptName: RS_RESERVE_SCRIPT_NAME,
    memo,
  };
}

/**
 * Convenience wrapper for `agent.createReserve` that uses the
 * canonical Rosen-bridged reserve script. Returns the SDK's
 * `ReserveResult` unchanged; integrators can layer their own checks on
 * top.
 */
export async function createRosenReserve(
  agent: ErgoAgentPay,
  args: Parameters<typeof buildRosenReserveConfig>[0]
) {
  return agent.createReserve(buildRosenReserveConfig(args));
}

/**
 * Build a `NoteOptions` for a Note denominated in a Rosen-bridged token.
 *
 * @example
 *   const usdt = resolveErgoSideToken(tokenMap, { chain: "ethereum", name: "USDT" })
 *   const opts = buildRosenNoteOptions({
 *     token: usdt,
 *     recipient: "9X...",
 *     amount: 5_000_000n,        // 5 rsUSDT (6 decimals)
 *     reserveBoxId,
 *     deadline: "+100 blocks",
 *     taskHash,
 *   })
 *   await agent.issueNote(opts)
 */
export function buildRosenNoteOptions(args: {
  token: TokenLookupResult;
  recipient: string;
  /** Amount in the wrapped-token's smallest unit (e.g. for USDT with 6 decimals: 5_000_000n = 5 USDT). */
  amount: bigint | string | number;
  reserveBoxId: string;
  deadline: NoteOptions["deadline"];
  taskHash?: string;
  credentialKey?: string;
}): NoteOptions & { rosenTokenId: string } {
  const tree = tryGetErgoTree(RS_RESERVE_SCRIPT_NAME);
  if (!tree) {
    throw new RosenIntegrationError(
      "ergo-agent-scripts has no compiled basis_token_reserve_v0 tree.",
      "MISSING_TOKEN_MAP"
    );
  }
  const opts: NoteOptions & { rosenTokenId: string } = {
    recipient: args.recipient,
    value: args.amount,
    reserveBoxId: args.reserveBoxId,
    deadline: args.deadline,
    taskHash: args.taskHash,
    credentialKey: args.credentialKey,
    scriptErgoTree: tree,
    scriptName: RS_RESERVE_SCRIPT_NAME,
    rosenTokenId: args.token.ergoTokenId,
  };
  return opts;
}
