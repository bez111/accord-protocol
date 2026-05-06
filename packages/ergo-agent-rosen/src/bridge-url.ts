// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-rosen — bridge-URL builder
//
// Generates a deep link to the Rosen Bridge UI prefilled with the user's
// from / to / asset / amount / recipient. The user clicks once; their wallet
// (MetaMask, Nautilus, Lace, etc.) opens to sign the lock transaction.
//
// Bridge IN (Ethereum/etc → Ergo):
//   The user signs the lock TX in their source-chain wallet. After ~30 min
//   (Rosen watcher confirmation), the wrapped token (rsUSDT, rsBTC, …)
//   appears at the recipient address on Ergo.
//
// Bridge OUT (Ergo → Ethereum/etc):
//   Same flow, signed in Nautilus on the Ergo side. Wrapped tokens are
//   burned, native asset arrives at the destination after watcher quorum.
//
// We don't sign or submit anything ourselves — that would require holding
// keys for two chains. The deep link is the integration contract.
// ─────────────────────────────────────────────────────────────────────────────

import type { BridgeUrlInput, RosenChain } from "./types.js";
import { RosenIntegrationError } from "./types.js";

/**
 * Default Rosen Bridge UI host. Override via `BridgeUrlBuilder` constructor
 * for testnet, self-hosted, or non-mainnet deployments.
 */
export const DEFAULT_ROSEN_HOST = "https://app.rosen.tech";

const VALID_CHAINS: ReadonlySet<RosenChain> = new Set([
  "ergo",
  "ethereum",
  "binance",
  "bitcoin",
  "bitcoin-runes",
  "cardano",
  "doge",
]);

export interface BridgeUrlBuilderOptions {
  /** Host of the Rosen UI. Default: `https://app.rosen.tech`. */
  host?: string;
}

export class BridgeUrlBuilder {
  private readonly host: string;

  constructor(opts: BridgeUrlBuilderOptions = {}) {
    this.host = (opts.host ?? DEFAULT_ROSEN_HOST).replace(/\/+$/, "");
  }

  /**
   * Build a deep link that opens the Rosen UI with the bridge form
   * pre-filled. The user still has to confirm and sign with their wallet.
   *
   * Query parameters used by app.rosen.tech: `from`, `to`, `token`,
   * `amount`, `address`. We pass through whatever the caller supplies and
   * URL-encode each value once.
   */
  bridge(input: BridgeUrlInput): string {
    if (!VALID_CHAINS.has(input.from)) {
      throw new RosenIntegrationError(
        `Unsupported source chain "${input.from}".`,
        "UNSUPPORTED_CHAIN"
      );
    }
    if (!VALID_CHAINS.has(input.to)) {
      throw new RosenIntegrationError(
        `Unsupported destination chain "${input.to}".`,
        "UNSUPPORTED_CHAIN"
      );
    }
    if (input.from === input.to) {
      throw new RosenIntegrationError(
        `Source and destination chains are the same ("${input.from}"). Bridge URL is meaningless.`,
        "UNSUPPORTED_CHAIN"
      );
    }

    const params = new URLSearchParams();
    params.set("from", input.from);
    params.set("to", input.to);
    params.set("token", input.asset);
    if (input.amount) params.set("amount", input.amount);
    if (input.recipient) params.set("address", input.recipient);

    return `${this.host}/?${params.toString()}`;
  }
}

/** Convenience wrapper: build a bridge URL with default host. */
export function bridgeUrl(input: BridgeUrlInput, host?: string): string {
  return new BridgeUrlBuilder({ host }).bridge(input);
}
