// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-rosen — type definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Chain identifiers used by Rosen Bridge. */
export type RosenChain =
  | "ergo"
  | "ethereum"
  | "binance"
  | "bitcoin"
  | "bitcoin-runes"
  | "cardano"
  | "doge";

/**
 * Asset descriptor for cross-chain lookups. Either:
 *   - `{ chain, native: true }` — the chain's native asset (BTC, ETH, ERG, ADA, …)
 *   - `{ chain, name }` — a non-native asset on the given chain (e.g. USDT on Ethereum)
 */
export type AssetDescriptor =
  | { chain: RosenChain; native: true }
  | { chain: RosenChain; name: string };

export interface TokenLookupResult {
  /** The asset's Ergo-side tokenId (the rs* wrapped form on Ergo). */
  ergoTokenId: string;
  /** The asset's name on the source chain. */
  sourceName: string;
  /** Decimals on the source chain. */
  sourceDecimals: number;
  /** Decimals of the wrapped (Ergo-side) value. */
  wrappedDecimals: number;
  /** Source-chain tokenId / asset id (or "native"). */
  sourceTokenId: string;
}

/**
 * Subset of the `@rosen-bridge/tokens` `TokenMap` API the SDK relies on.
 * We type the surface explicitly so consumers can pass either a real
 * `TokenMap` instance or a stub for tests, without pulling the whole
 * package as a hard dependency.
 */
export interface TokenMapLike {
  getTokens(fromChain: string, toChain: string): unknown[];
  getID(token: Record<string, unknown>, chain: string): string;
  getSignificantDecimals(tokenId: string): number | undefined;
  search(chain: string, condition: Record<string, unknown>): Record<string, unknown>[];
}

export interface BridgeUrlInput {
  /** Source chain (where the user holds the asset). */
  from: RosenChain;
  /** Destination chain (where the wrapped asset will appear). */
  to: RosenChain;
  /** Asset name on the source chain. Use `"native"` for the chain's native asset. */
  asset: string;
  /** Human-readable amount (e.g. "5", "0.05"). */
  amount?: string;
  /** Recipient address on the destination chain. */
  recipient?: string;
}

export class RosenIntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: RosenIntegrationErrorCode
  ) {
    super(message);
    this.name = "RosenIntegrationError";
  }
}

export type RosenIntegrationErrorCode =
  | "TOKEN_NOT_FOUND"
  | "UNSUPPORTED_CHAIN"
  | "MALFORMED_TOKEN_MAP"
  | "MISSING_TOKEN_MAP";
