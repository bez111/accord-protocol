# Mainnet ErgoTree Audit — Scope and Procedure

## Objective

Certify that every ErgoTree byte string used by `ergo-agent-economy` on mainnet corresponds to reviewed ErgoScript source and enforces the intended on-chain semantics:

- Reserve cannot be drained outside approved redemption/top-up/mint paths.
- Note expiry cannot be bypassed.
- Task hash cannot be substituted or checked with the wrong hash function.
- Tracker / Basis state cannot be replayed or double-redeemed.
- SDK cannot accidentally deploy P2PK boxes on mainnet while presenting them as predicate-bound Notes/Reserves.

## Required reviewer profile

The reviewer should have hands-on experience with:

- ErgoScript and eUTXO transaction semantics.
- ErgoTree bytecode / propositionBytes inspection.
- sigma-state interpreter behavior.
- AVL tree proofs in Ergo.
- Fleet SDK compiler and/or AppKit / sigmastate-jvm compiler.
- Mempool/front-running risks in bearer-style predicates.

## Required repository artifacts

The audit cannot start until the repository contains these committed artifacts:

1. `SPEC.md` with frozen v0/v1 register layout and predicate semantics.
2. `packages/ergo-agent-scripts/data/predicates.json` with every shipped `ergoTreeHex` populated.
3. `AUDITED_ERGOTREES.json` with source hashes, post-template source hashes, tree hashes, compiler identity, and reviewer signatures.
4. `packages/ergo-agent-scripts/data/sources/*.es` with the exact source files reviewed.
5. A reproducible compile command pinned by lockfile.
6. A verification command that fails if any source, compiled tree, or tree hash differs from the audited manifest.
7. Negative and positive spend tests against an ErgoTree interpreter.

## Minimum tree set in scope

The currently declared registry contains the following predicate/contract entries and should be in scope:

- `task_hash_v0`
- `credential_v0`
- `chaincash_reserve_v0`
- `chaincash_receipt_v0`
- `chaincash_note_v0`
- `basis_reserve_v0`
- `basis_token_reserve_v0`

If `tracker_v0` is introduced separately, it must be added to the manifest before mainnet.

## Byte-level trace to verify

For every entry:

```text
source file / inline source
  -> normalized source hash
  -> post-template source hash, if template variables are substituted
  -> compiler name + exact version + lockfile hash
  -> ergoTreeHex
  -> blake2b256(raw ErgoTree bytes)
  -> audited manifest entry
  -> SDK call site using that exact tree
```

The audit must not accept “non-empty `scriptErgoTree`” as sufficient. It must prove that the tree is one of the audited, named trees.

## Required semantic checks

### Acceptance predicates

For `task_hash_v0` and `credential_v0`, verify:

- `SELF.R5[Int].get` is the expiry height.
- Spend succeeds only when `HEIGHT < SELF.R5`.
- Spend fails when `HEIGHT >= SELF.R5`.
- `SELF.R6[Coll[Byte]].get` is exactly 32 bytes.
- Task output is taken from context variable `0` as `Coll[Byte]`.
- Hash is `blake2b256(taskOutput)`, not SHA-256.
- `credential_v0` requires `proveDlog(SELF.R7[GroupElement].get)`.
- `task_hash_v0` is treated as a bearer predicate and is not used for mainnet redemption unless front-running risk is accepted or mitigated.

### ChainCash reserve/note/receipt contracts

For `chaincash_reserve_v0`, `chaincash_note_v0`, and `chaincash_receipt_v0`, verify:

- Reserve redemption path cannot reduce collateral beyond the valid note redemption amount.
- Oracle and buyback NFT checks are correct and intentional.
- Receipt creation and receipt contract checks compose correctly across Reserve/Note/Receipt.
- The note redemption path cannot be redirected to a fake reserve or fake receipt.
- The reserve top-up and mint-note paths preserve all intended registers, including R5 if it is part of the invariant.
- Owner/key signature requirements are exactly as intended on every action path.

### Basis reserve contracts

For `basis_reserve_v0` and `basis_token_reserve_v0`, verify:

- Tracker NFT in `SELF.R6` is checked against the tracker data input.
- Tracker AVL proof proves the current `totalDebt`.
- Reserve AVL proof and insert/update semantics correctly prevent double-redemption.
- Timestamp monotonicity blocks replay without blocking valid partial redemptions.
- Emergency redemption semantics match the documentation.
- ERG and token variants preserve the right value/token invariants.

## Required negative tests

The audit should include failing tests for at least these cases:

1. Correct task output but expired height.
2. Wrong task output before expiry.
3. Correct task output but wrong R6 hash.
4. SHA-256 task hash instead of BLAKE2b-256.
5. Missing context variable 0.
6. Context variable 0 encoded with invalid length.
7. `task_hash_v0` redemption front-run simulation, unless explicitly accepted as bearer risk.
8. Mainnet `issueNote` without audited script.
9. Mainnet `createReserve` without audited script.
10. Mainnet arbitrary non-empty but unaudited `scriptErgoTree`.
11. ChainCash reserve redemption with fake oracle NFT.
12. ChainCash reserve top-up/mint path trying to mutate R5.
13. Basis second redemption for same `(owner, receiver)` pair.
14. Basis redemption with stale timestamp.
15. Basis redemption with tracker AVL proof for a different amount.
16. Basis token reserve attempting to change token IDs or leak reserve token units.

## Acceptance gates

Mainnet release is blocked until all gates are green:

- [ ] External reviewer signs the exact commit hash and manifest hash.
- [ ] Every shipped `ergoTreeHex` has an audited source hash and tree hash.
- [ ] Reproducible compile succeeds from a clean checkout.
- [ ] A second compiler/interpreter path confirms the same semantics, ideally AppKit/sigmastate-jvm.
- [ ] SDK refuses unaudited tree names on mainnet, not merely empty trees.
- [ ] Raw builders cannot bypass production guardrails without an explicit `dangerously*` API.
- [ ] Context variable encoding is either proper Sigma varint or hard-limited to v0 max length.
- [ ] `task_hash_v0` is not the default mainnet predicate unless bearer/front-run semantics are intentionally documented and accepted.
- [ ] SECURITY.md explains the audited scope and what is not audited.

## Output expected from the external auditor

The final audit report should contain:

- Repository commit SHA.
- Manifest SHA-256 or BLAKE2b-256.
- List of audited tree names.
- For every tree: source hash, post-template source hash, tree hex hash, compiler path, semantic verdict.
- Findings with severity and remediation status.
- Explicit statement on whether mainnet deployment is recommended, conditional, or rejected.
