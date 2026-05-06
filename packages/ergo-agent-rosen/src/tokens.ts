// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-rosen — token lookup
//
// Wraps a Rosen `TokenMap` (from @rosen-bridge/tokens) so callers can ask
// "what is the rsUSDT tokenId on Ergo for USDT-on-Ethereum?" without
// learning the underlying TokenMap shape.
//
// We keep `TokenMap` as a peer dependency, not a hard one, so consumers
// who want only the `bridgeUrl` / Reserve-helpers don't pay the cost.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AssetDescriptor,
  RosenChain,
  TokenLookupResult,
  TokenMapLike,
} from "./types.js";
import { RosenIntegrationError } from "./types.js";

const NATIVE_KEY = "native";
const ERGO_CHAIN = "ergo";

/**
 * Resolve a cross-chain asset to its Ergo-side wrapped tokenId.
 *
 * Rosen's `TokenMap` is consulted: every supported asset has an entry per
 * chain it is reachable on, and the entry on Ergo carries the
 * `rs*`-prefixed wrapped-token's tokenId.
 *
 * @example
 *   const usdtOnErgo = resolveErgoSideToken(tokenMap, { chain: "ethereum", name: "USDT" })
 *   // → { ergoTokenId: "...", sourceTokenId: "...", wrappedDecimals: 6, ... }
 */
export function resolveErgoSideToken(
  tokenMap: TokenMapLike,
  asset: AssetDescriptor
): TokenLookupResult {
  if (asset.chain === ERGO_CHAIN && "native" in asset && asset.native) {
    throw new RosenIntegrationError(
      "Cannot resolve Ergo native asset (ERG) as a Rosen-bridged tokenId — ERG is not bridged.",
      "UNSUPPORTED_CHAIN"
    );
  }

  const condition: Record<string, unknown> =
    "native" in asset && asset.native === true
      ? { residency: "native", type: "native" }
      : { name: (asset as { name: string }).name };

  const matches = tokenMap.search(asset.chain, condition);
  if (matches.length === 0) {
    throw new RosenIntegrationError(
      `No token matching ${describeAsset(asset)} found in the configured Rosen TokenMap.`,
      "TOKEN_NOT_FOUND"
    );
  }
  if (matches.length > 1) {
    throw new RosenIntegrationError(
      `Ambiguous lookup for ${describeAsset(asset)}: ${matches.length} matches. ` +
        `Refine the condition or pass an exact tokenId.`,
      "TOKEN_NOT_FOUND"
    );
  }

  const tokenSet = matches[0]!;
  const ergoSide = tokenSet[ERGO_CHAIN] as Record<string, unknown> | undefined;
  if (!ergoSide || typeof ergoSide["tokenId"] !== "string") {
    throw new RosenIntegrationError(
      `Asset ${describeAsset(asset)} has no Ergo-side mapping in the TokenMap.`,
      "MALFORMED_TOKEN_MAP"
    );
  }

  const sourceSide = tokenSet[asset.chain] as Record<string, unknown> | undefined;
  if (!sourceSide) {
    throw new RosenIntegrationError(
      `Asset ${describeAsset(asset)} is missing its source-chain entry in the TokenMap.`,
      "MALFORMED_TOKEN_MAP"
    );
  }

  const ergoTokenId = ergoSide["tokenId"] as string;
  const sourceTokenId =
    typeof sourceSide["tokenId"] === "string" ? (sourceSide["tokenId"] as string) : NATIVE_KEY;

  const wrappedDecimals = tokenMap.getSignificantDecimals(ergoTokenId);
  if (wrappedDecimals === undefined) {
    throw new RosenIntegrationError(
      `TokenMap returned no decimals for tokenId ${ergoTokenId}.`,
      "MALFORMED_TOKEN_MAP"
    );
  }

  return {
    ergoTokenId,
    sourceName: typeof sourceSide["name"] === "string" ? (sourceSide["name"] as string) : "",
    sourceDecimals:
      typeof sourceSide["decimals"] === "number" ? (sourceSide["decimals"] as number) : 0,
    wrappedDecimals,
    sourceTokenId,
  };
}

/**
 * List the Ergo-side wrapped tokens that can be redeemed back to a given
 * destination chain. Useful for an agent UI to show "you can pay in
 * rsUSDT, rsBTC, rsETH, …" depending on what watchers cover.
 */
export function listSupportedFromChain(
  tokenMap: TokenMapLike,
  fromChain: RosenChain
): TokenLookupResult[] {
  if (fromChain === ERGO_CHAIN) {
    throw new RosenIntegrationError(
      "Use listSupportedToChain to enumerate assets bridgeable FROM Ergo.",
      "UNSUPPORTED_CHAIN"
    );
  }
  const tokens = tokenMap.getTokens(fromChain, ERGO_CHAIN) as Array<Record<string, unknown>>;
  const out: TokenLookupResult[] = [];
  for (const tokenSet of tokens) {
    const ergoSide = tokenSet[ERGO_CHAIN] as Record<string, unknown> | undefined;
    const sourceSide = tokenSet[fromChain] as Record<string, unknown> | undefined;
    if (!ergoSide || !sourceSide) continue;
    if (typeof ergoSide["tokenId"] !== "string") continue;
    const ergoTokenId = ergoSide["tokenId"] as string;
    const wrappedDecimals = tokenMap.getSignificantDecimals(ergoTokenId);
    if (wrappedDecimals === undefined) continue;
    out.push({
      ergoTokenId,
      sourceName: (sourceSide["name"] as string) ?? "",
      sourceDecimals: (sourceSide["decimals"] as number) ?? 0,
      wrappedDecimals,
      sourceTokenId:
        typeof sourceSide["tokenId"] === "string"
          ? (sourceSide["tokenId"] as string)
          : NATIVE_KEY,
    });
  }
  return out;
}

function describeAsset(a: AssetDescriptor): string {
  if ("native" in a && a.native === true) return `native asset on ${a.chain}`;
  return `${(a as { name: string }).name} on ${a.chain}`;
}
