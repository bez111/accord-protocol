# ChainCash / Basis Integration Guide

[ChainCash / Basis](https://github.com/BetterMoneyLabs/chaincash) is the
external reference work that informed Accord's Ergo credit and reserve design.
This page is an Accord-local integration note; it is not a mainnet launch
guide and it does not override [`docs/status.md`](./status.md) or
[`SECURITY.md`](../SECURITY.md).

Accord treats ChainCash/Basis sources, compiled trees, and related rail
adapters as **reference / research / draft-pre-audit** material until a signed
audit manifest marks the exact artifact `mainnetAllowed: true`.

Use local or testnet flows by default. Do not use real funds unless the exact
script or runtime bytecode hash you are using is externally audited, present in
the relevant signed manifest, and explicitly allowed for mainnet.

---

## Upstream sources checked

| Source | What it contributes |
|---|---|
| [`docs/basis/abstract.md`](https://github.com/BetterMoneyLabs/chaincash/blob/master/docs/basis/abstract.md) | Basis model: local IOU credit, optional on-chain reserves, offchain payments, tracker transparency. |
| [`docs/basis/basis.tex`](https://github.com/BetterMoneyLabs/chaincash/blob/master/docs/basis/basis.tex) | Paper-level description of IOU notes, debt transfer, tracker commitments, emergency exit, and tracker trust limits. |
| [`contracts/offchain`](https://github.com/BetterMoneyLabs/chaincash/tree/master/contracts/offchain) | Current offchain reserve contracts and operational docs: `basis.es`, `basis-token.es`, `basis.md`, `tracker.md`. |

The executable contract files are the source of truth for register layout,
context extension variables, and spend conditions. Some prose in upstream docs
is older than the contracts, so Accord docs should not repeat stale `nonce` or
one-week-maturity wording when describing `basis.es` / `basis-token.es`.

---

## Current Basis offchain model

Basis is not "three separate offchain scripts called
`reserveScript.es`, `noteScript.es`, and `trackerScript.es`". The current
`contracts/offchain` surface is:

| Component | Current Basis shape | Accord-local reference |
|---|---|---|
| ERG reserve | On-chain reserve contract in `basis.es`. | `packages/ergo-agent-scripts/data/sources/basis.es` as `basis_reserve_v0`. |
| Token reserve | On-chain reserve contract in `basis-token.es`. Notes are denominated in the same token held by the reserve. | `packages/ergo-agent-scripts/data/sources/basis-token.es` as `basis_token_reserve_v0`. |
| IOU note | Offchain record witnessed by tracker and signed by issuer; not a separate `contracts/offchain/noteScript.es` file. | Accord receipts and rail adapters reference the settlement evidence; they do not make the note production-certified. |
| Tracker | Offchain service that witnesses notes, tracks debt state, publishes status/events, and commits a digest on-chain. | External service / data-input assumption; no custody and no unilateral redemption power. |

The tracker cannot steal reserve funds by itself because redemption still needs
the reserve owner's signature. It can, however, censor, go offline, publish
stale state, reorder undercollateralized redemptions, or collude in ways the
audit must analyze.

---

## Debt and redemption semantics

For a debt relationship `A -> B`, Basis tracks cumulative debt:

- Key: `Blake2b256(A_pubkey || B_pubkey)`.
- Total debt: an ever-increasing `Long` amount.
- Timestamp: milliseconds since Unix epoch, bound into issuer and tracker
  signatures and used by the reserve's redemption tree.
- Signature message in the current contracts:
  `key || totalDebt || timestamp`.

The reserve UTXO stores:

- `R4`: reserve owner public key.
- `R5`: AVL tree keyed by `hash(ownerKey || receiverKey)`.
- `R5` value: `timestamp (8 bytes) || cumulativeRedeemedAmount (8 bytes)`.
- `R6`: tracker NFT id.

Normal redemption requires:

- receiver public key;
- reserve owner signature on `key || totalDebt || timestamp`;
- tracker signature on the same message;
- tracker AVL proof that the current `totalDebt` is committed;
- reserve AVL proof/update for `(timestamp, cumulativeRedeemedAmount)`;
- receiver signature on the transaction.

The replay guard is cumulative: a redemption must have
`timestamp > storedTimestamp` and must not redeem more than
`totalDebt - cumulativeRedeemedAmount`.

Emergency redemption is contract-level, not a separate prose-only policy:
after roughly 3 days / 2160 Ergo blocks from the tracker box creation, the
tracker signature may be omitted, while the reserve owner signature and tracker
state proof remain part of the model.

---

## Debt transfer

Basis supports debtor-consent novation. If A owes B and B wants to pay C with
part of that debt, A signs two updated notes:

- a reduced A -> B note for the remaining amount;
- a new A -> C note for the transferred amount.

The tracker witnesses both updates. After that, A owes C directly for the
transferred amount. This is not bearer transfer without debtor consent.

---

## Using Basis trees in Accord

The local registry names are:

```ts
import { tryGetErgoTree } from "ergo-agent-scripts"

const ergReserveTree = tryGetErgoTree("basis_reserve_v0")
const tokenReserveTree = tryGetErgoTree("basis_token_reserve_v0")
```

These values are manifest-gated references. `tryGetErgoTree(...)` returning a
tree does **not** mean it is production-audited. Mainnet use still requires the
relevant signed audit manifest entry with `mainnetAllowed: true`.

Do not invent or paste a simplified reserve script into production docs. Use
the exact audited source, exact compiled tree, exact tree hash, and exact
manifest entry.

---

## Development vs production

| | Development / testnet | Production candidate |
|---|---|---|
| Reserve | P2PK dev boxes or draft Basis trees | Exact audited `basis.es` / `basis-token.es` tree hash |
| Note evidence | Local/testnet note or Accord receipt evidence | Agreement + verification + settlement receipt with rail proof |
| Tracker | Local/test tracker acceptable | Audited tracker operations, keys, state commitments, monitoring |
| ChainCash/Basis status | Reference / research | Only exact artifacts signed by external auditor |
| Mainnet | Blocked by default | Allowed only when manifests say `mainnetAllowed: true` |

The right production story is not "ChainCash exists, therefore Accord is
mainnet-ready." The right story is: exact Basis artifact, exact tracker
assumptions, exact compiled bytes, exact audit scope, signed manifest, and a
capped launch plan.
