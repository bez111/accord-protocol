# Basis offchain IOU money - Accord reading note

This page summarizes the ChainCash / Basis material Accord depends on. The
upstream sources are:

- [`docs/basis/abstract.md`](https://github.com/BetterMoneyLabs/chaincash/blob/master/docs/basis/abstract.md)
- [`docs/basis/basis.tex`](https://github.com/BetterMoneyLabs/chaincash/blob/master/docs/basis/basis.tex)
- [`contracts/offchain`](https://github.com/BetterMoneyLabs/chaincash/tree/master/contracts/offchain)

Accord's local vendored Basis trees are draft-pre-audit references. They are
not a production certification and they do not authorize mainnet value until a
signed audit manifest marks the exact artifact `mainnetAllowed: true`.

---

## What Basis is

Basis is an offchain IOU credit system with optional on-chain reserves. Local
trust relationships can create credit without forcing every payment to be
fully collateralized. When trust is not enough, a reserve contract can back
redemption on Ergo.

Payments and debt transfers are offchain. Blockchain coordination is needed
when a creditor redeems a witnessed debt note against a reserve, or when a
tracker commits state for emergency exit.

Compared with Lightning, Cashu, or Fedimint, Basis does not require every
offchain payment unit to be fully backed at the protocol level. That is the
point of the design, but it also makes tracker policy, collateralization
visibility, and audit scope much more important.

---

## Components

| Component | Role |
|---|---|
| IOU note | Offchain record for `A -> B` debt. It is signed by issuer A and witnessed by a tracker. |
| Reserve contract | On-chain ErgoScript that releases ERG or a token when signatures, AVL proofs, and replay guards pass. |
| Tracker | Offchain witness/state service. It tracks debt, signs witnessed notes, publishes status, and commits a digest on-chain. |
| Tracker commitment | AVL digest proving the current debt state for emergency redemption and public verification. |

The current `contracts/offchain` implementation has reserve contracts
(`basis.es` and `basis-token.es`) plus tracker/offchain docs. It is not a
directory of separate `reserveScript.es`, `noteScript.es`, and
`trackerScript.es` files.

---

## IOU data model

For an issuer A paying receiver B:

- Pair key: `Blake2b256(A_pubkey || B_pubkey)`.
- Amount: cumulative total debt A owes B, not just the latest delta.
- Timestamp: latest payment timestamp in milliseconds since Unix epoch.
- Signature message in the current contracts:
  `key || totalDebt || timestamp`.

The paper describes the tracker model as
`hash(payerKey || payeeKey) -> (totalDebt, timestamp)`. The current
`basis.es` / `basis-token.es` contract lookup binds `totalDebt` through the
tracker AVL proof, while `timestamp` is bound by the issuer/tracker signatures
and enforced through the reserve redemption tree.

---

## Reserve contract state

Current Basis reserve scripts use:

- `R4`: reserve owner public key.
- `R5`: AVL tree tracking redemption state per `(owner, receiver)`.
- `R6`: tracker NFT id.

`R5` maps:

```text
hash(ownerKey || receiverKey) -> timestamp || cumulativeRedeemedAmount
```

Both values are 8-byte big-endian `Long`s, so the stored value is 16 bytes.
This is stronger than an older "timestamp only" description because it also
tracks how much of the cumulative debt has already been redeemed.

---

## Redemption

A normal redemption presents:

- receiver public key;
- reserve owner signature on `key || totalDebt || timestamp`;
- tracker signature on the same message;
- current `totalDebt`;
- timestamp;
- proof/update for the reserve redemption AVL tree;
- tracker AVL proof that `key -> totalDebt` is committed;
- receiver transaction signature.

The reserve releases only the delta:

```text
redeemable <= totalDebt - cumulativeRedeemedAmount
```

It also requires:

```text
timestamp > storedTimestamp
```

This prevents replaying an older note after a newer note has been redeemed.

---

## Emergency exit

If the tracker becomes unavailable, the current contracts allow redemption
without a tracker signature after roughly 3 days / 2160 Ergo blocks from the
tracker box creation. The reserve owner signature is still required, and the
redemption still uses the committed tracker state/proof model.

Do not describe the current contract as having a generic "one week after note
creation" redemption delay. That wording appears in older prose, but it is not
the executable behavior of the current `basis.es` / `basis-token.es` files.

---

## Debt transfer

Basis debt transfer is debtor-consent novation:

1. A owes B.
2. B wants to pay C using part of A's debt.
3. A signs an updated A -> B note for the remaining debt.
4. A signs a new A -> C note for the transferred amount.
5. The tracker witnesses both updates.

After the update, A owes C directly. B cannot unilaterally transfer A's debt
without A's fresh signatures.

---

## Tracker trust limits

The tracker cannot redeem funds alone because reserve owner signatures are
required. It can still create operational and economic risk:

- going offline;
- censoring new notes or omitting notes from committed state;
- publishing stale or delayed commitments;
- reordering redemption flow for undercollateralized reserves;
- colluding with an issuer around timestamps or collateralization policy;
- becoming a single point of liveness unless federated or replaced by a
  sidechain/rollup-style design.

Those are audit and operations questions, not marketing footnotes.

---

## Accord integration notes

Accord currently exposes the Basis reserve trees as:

- `basis_reserve_v0`
- `basis_token_reserve_v0`

They live under
[`packages/ergo-agent-scripts/data/sources`](../../packages/ergo-agent-scripts/data/sources)
and the manifest scaffold lives in
[`packages/ergo-agent-scripts/data/AUDITED_ERGOTREES.json`](../../packages/ergo-agent-scripts/data/AUDITED_ERGOTREES.json).

The manifest is still default-deny. Treat these trees as testnet/reference
inputs until an external audit signs exact source hashes, exact compiled tree
hashes, tracker assumptions, and `mainnetAllowed: true`.
