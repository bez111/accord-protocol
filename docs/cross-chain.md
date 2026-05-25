# Cross-chain agent payments via Rosen Bridge

The agent-economy story works in USD-stable terms when stablecoins
flow into Ergo via [Rosen Bridge](https://rosen.tech). This document
describes the integration architecture, the residual risk surface, and
the migration path to a future native multi-chain implementation.

## TL;DR

* **Buyer holds USDT/USDC** on Ethereum (or BTC, ADA, BNB, …).
* **One-time bridge** via Rosen UI deposits `rsUSDT` (or rsBTC, rsADA, …)
  on Ergo at the buyer's address. Watcher confirmation ~30 min.
* **Notes are issued in `rsUSDT`** using the audited
  `basis_token_reserve_v0` ergoTree from `ergo-agent-scripts`. No new
  on-chain code is introduced; the audit gate is unchanged.
* **Sellers settle in `rsUSDT`** and batch-bridge out to USDT on
  Ethereum at their convenience (one bridge TX per day, hour, etc.).
* **No custodial intermediary** — bridges are signed in the user's
  wallet (MetaMask / Nautilus / Lace) via a deep link our SDK
  generates.

## What's stable

| Property | Native to Ergo? | Source |
|---|---|---|
| BLAKE2b-256 task-hash | ✅ | ergo-agent-pay |
| Audit gate (`UNAUDITED_ERGOTREE`) | ✅ | ergo-agent-pay safety |
| `basis_token_reserve_v0` ergoTree | ✅ | ergo-agent-scripts |
| Audit-manifest binding by name | ✅ | ergo-agent-scripts |
| ChainCash / Basis on-chain semantics | ✅ | vendored sources |

The Rosen integration is **metadata-only** on top of the audited
contract. The same `mainnetAllowed: false` gate from the manifest
still applies, the same `verifyAuditedErgoTree` still runs.

## What's bridge-trust

| Property | Source |
|---|---|
| `rsUSDT` ↔ `USDT-on-Ethereum` peg | Rosen watcher network signatures |
| `rsBTC` ↔ `BTC` peg | Same |
| Bridge availability and watcher liveness | Rosen ops |
| Per-asset minimum bridge fee | Set by Rosen team |

Trust the Rosen watcher set if you accept rs-prefixed assets. This is
the same trust assumption Rosen Bridge users already make for any
cross-chain swap; we add no incremental trust on top.

## Where the SDK ends

The SDK does **not**:

* Hold keys for any chain other than Ergo.
* Build, sign, or submit bridge transactions on the source chain. The
  bridge URL hands the user to MetaMask (or equivalent); they sign
  there. We never see the EVM private key.
* Embed a Rosen TokenMap. Consumers pass a `TokenMap` instance from
  `@rosen-bridge/tokens` populated from whichever network they target.
  Mainnet token map is published by Rosen ops; testnet map is
  separate.

What the SDK does:

* Resolve "USDT on Ethereum" to its Ergo-side `rsUSDT` tokenId via the
  TokenMap.
* Generate a one-click bridge URL prefilled with from / to / amount /
  recipient.
* Pass the canonical audited tree to `agent.createReserve` /
  `agent.issueNote` so audit policies see the correct manifest entry.
* Convenience wrappers so an integrator does not need to learn the
  Rosen TokenMap internals.

## Migration path to native multi-chain

The Rosen integration buys us **stablecoin-denominated agent
payments today**, with the existing audited contract surface. It does
not yet remove all the friction of "bridge first, pay later":

* Buyer must complete one bridge before their first payment.
* Seller batches outbound bridges (or settles in rsUSDT internally).
* Bridge confirmation latency is ~30 min, irrelevant for daily-paid
  agent flows but real for one-shot interactions.

The next phase — native multi-chain — replaces the bridge step
with a native-stablecoin payment path:

* `agentpay-base` package implementing Reserve / Note / Tracker on
  Base with ERC-20 USDC.
* Same SPEC, same SDK shape, different audit manifest.
* Agents on Base never touch Ergo at all if they do not want to.

The two paths can coexist. Sellers can accept rsUSDT (Ergo path) and
USDC (Base path) from the same SDK by toggling the network — the
audit gate routes to the right manifest entry per chain.

## Reading list

* [SPEC.md](../SPEC.md) — the chain-agnostic protocol spec.
* [packages/ergo-agent-rosen/README.md](../packages/ergo-agent-rosen/README.md)
  — the package's own docs.
* [examples/11-cross-chain-rosen/README.md](../examples/11-cross-chain-rosen/README.md)
  — runnable buyer + seller demo.
* [Rosen Bridge documentation](https://rosen.tech) — for the bridge
  itself, watcher network, supported chains.
