# ergo-agent-rosen

Cross-chain glue between [`ergo-agent-pay`](../ergo-agent-pay) and
[Rosen Bridge](https://rosen.tech). Lets agents accept and settle
**stablecoin payments on Ergo** (rsUSDT, rsUSDC, rsBTC, rsETH, …)
bridged from Ethereum, Bitcoin, Cardano, Binance, and any chain
Rosen watchers cover.

## Why this exists

Agentic payments need **USD-stable pricing** — agents reasoning about
"$0.05 per inference" don't want to deal with ERG volatility. Rosen
Bridge wraps stablecoins (USDT, USDC) and BTC / ETH onto Ergo as
`rs*`-prefixed tokens. The manifest-gated
[`basis_token_reserve_v0`](../ergo-agent-scripts) script supports
token-collateralised Reserves; this package wires the two together
with three helpers. This is still testnet-first / draft-pre-audit
software, not a mainnet certification.

* `resolveErgoSideToken(tokenMap, asset)` — look up the canonical
  Ergo-side tokenId for any cross-chain asset.
* `bridgeUrl({ from, to, asset, amount, recipient })` — generate a
  deep link to the Rosen UI prefilled with the bridge form.
* `buildRosenReserveConfig` / `buildRosenNoteOptions` — produce
  `ReserveConfig` / `NoteOptions` ready to pass to
  `agent.createReserve` / `agent.issueNote`, with the manifest-gated tree
  and scriptName already set.

## What this package does NOT do

* Sign or submit bridge transactions. That requires keys on two chains
  and is the user's wallet's job. We hand the user a deep link; they
  click and sign.
* Embed a Rosen TokenMap. The map is published per-network by the
  Rosen team; consumers pass a `TokenMap` instance (or any
  `TokenMapLike` shape) at lookup time.
* Replace `ergo-agent-pay`. This package complements it.

## Install

```bash
npm install ergo-agent-rosen ergo-agent-pay ergo-agent-scripts @rosen-bridge/tokens
```

`@rosen-bridge/tokens` is an optional companion package. Install it only
if you use Rosen's official `TokenMap` with `resolveErgoSideToken`; the
bridge-URL builder and Reserve helpers work without it, and tests can pass
any object matching the `TokenMapLike` shape.

## Quick start

```ts
import { ErgoAgentPay } from "ergo-agent-pay"
import { TokenMap } from "@rosen-bridge/tokens"
import {
  resolveErgoSideToken,
  buildRosenReserveConfig,
  buildRosenNoteOptions,
  bridgeUrl,
} from "ergo-agent-rosen"

// 1. Load Rosen's TokenMap for the network you are testing.
const tokenMap = new TokenMap()
await tokenMap.updateConfigByJson(rosenTokensJson)

// 2. Find the Ergo-side rsUSDT tokenId.
const usdt = resolveErgoSideToken(tokenMap, { chain: "ethereum", name: "USDT" })
// → { ergoTokenId: "...", wrappedDecimals: 6, sourceTokenId: "0xdac17f958d2ee523a2206206994597c13d831ec7", ... }

// 3. Hand the buyer a one-click bridge URL.
const url = bridgeUrl({
  from: "ethereum",
  to: "ergo",
  asset: "USDT",
  amount: "5",
  recipient: buyerErgoAddress,
})
// → https://app.rosen.tech/?from=ethereum&to=ergo&token=USDT&amount=5&address=...

// 4. After the user bridges, build a Reserve and issue a Note in rsUSDT.
const agent = new ErgoAgentPay({ address, network: "testnet", signer, auditPolicy })

const reserve = await agent.createReserve(buildRosenReserveConfig({
  token: usdt,
  collateral: "1 ERG",
}))

const note = await agent.issueNote(buildRosenNoteOptions({
  token: usdt,
  recipient: subAgentAddress,
  amount: 5_000_000n,         // 5 rsUSDT (6 decimals)
  reserveBoxId: reserve.reserve.boxId!,
  deadline: "+100 blocks",
  taskHash,
}))
```

The Note is locked under the manifest-gated `basis_token_reserve_v0` tree.
The `auditPolicy` consults `verifyAuditedErgoTree("basis_token_reserve_v0", ...)`
exactly as for any other Reserve — the rs-token binding is in
metadata only, not in the tree.

## API

### `resolveErgoSideToken(tokenMap, asset): TokenLookupResult`

Resolve an asset descriptor (chain + name, or chain + native flag) to
its Ergo-side wrapped tokenId.

```ts
type AssetDescriptor =
  | { chain: RosenChain; native: true }
  | { chain: RosenChain; name: string };

interface TokenLookupResult {
  ergoTokenId: string;          // the rs-prefixed token's id on Ergo
  sourceName: string;           // e.g. "USDT"
  sourceDecimals: number;       // decimals on the source chain
  wrappedDecimals: number;      // decimals of the wrapped value
  sourceTokenId: string;        // source-chain id, or "native"
}
```

Throws `RosenIntegrationError` with a typed `code` when the lookup
fails: `TOKEN_NOT_FOUND`, `UNSUPPORTED_CHAIN`, `MALFORMED_TOKEN_MAP`.

### `listSupportedFromChain(tokenMap, fromChain): TokenLookupResult[]`

Returns every Ergo-side token reachable from a source chain. Useful
for an agent UI that wants to show "you can pay in rsUSDT, rsBTC,
rsETH, …".

### `bridgeUrl(input, host?) / new BridgeUrlBuilder(opts)`

Generate a deep link to the Rosen Bridge UI prefilled with the
bridge form. Default host is `https://app.rosen.tech`; override for
testnet or self-hosted UIs.

### `buildRosenReserveConfig(args)`

Returns a `ReserveConfig` for `agent.createReserve`. Sets
`scriptErgoTree` to the manifest-gated `basis_token_reserve_v0` tree,
`scriptName: "basis_token_reserve_v0"`, and a memo with a Rosen
prefix for traceability.

### `buildRosenNoteOptions(args)`

Returns a `NoteOptions` (with an extra `rosenTokenId` field for
introspection). Same manifest-gated tree binding.

## Supported chains

```
ergo, ethereum, binance, bitcoin, bitcoin-runes, cardano, doge
```

Whichever chains Rosen's watcher network covers in your environment.
Generic EVM chains (Base, Arbitrum, Optimism, …) are reachable as
`@rosen-chains/evm` matures and watchers add coverage; the SDK is
forwards-compatible — when those entries land in the TokenMap, this
package looks them up without code changes.

## Audit story

* The on-chain bytes are `basis_token_reserve_v0` from
  [`ergo-agent-scripts`](../ergo-agent-scripts) — same manifest-gated tree,
  same manifest entry, same `mainnetAllowed` rule.
* This package adds **only metadata** (which tokenId the Reserve is
  for, which Rosen network, which memo). It does not introduce new
  on-chain code.
* Bridge transactions are signed in the user's wallet, never by us.
  We do not custody and we do not produce signed transactions.

See [`SECURITY.md`](../../SECURITY.md) for the project's overall
mainnet-readiness story; `ergo-agent-rosen` inherits it 1:1.
