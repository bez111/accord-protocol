# Pre-Audit Findings — `ergo-agent-economy`

Status: pre-audit review, not an external audit certificate.

## Positive findings

1. Task hashing in the current TypeScript SDK uses BLAKE2b-256 via `@noble/hashes/blake2b` with `dkLen: 32`.
2. Python `compute_task_hash` uses `hashlib.blake2b(..., digest_size=32)`.
3. `SPEC.md` defines BLAKE2b-256, Note register layout, context variable 0, and production safety requirements.
4. `safety.ts` prevents high-level mainnet `createReserve`, `issueNote`, and `deployTracker` without `scriptErgoTree`, unless `allowInsecureDevMode` is explicitly enabled.
5. `ergo-agent-scripts` has a compiled predicate registry with tree hashes and a `verify-predicates` script.

## Critical blockers before mainnet

### A-001 — Non-empty `scriptErgoTree` is treated as production-safe, but not as audited

Current high-level guardrails accept any non-empty `scriptErgoTree` on mainnet. This prevents accidental P2PK fallback, but does not prove the tree is canonical, audited, or even related to the intended source.

Risk: an integration could pass a malicious or stale ErgoTree and still satisfy the SDK's mainnet safety check.

Required fix:

- Introduce `AUDITED_ERGOTREES.json`.
- Require `{ scriptName, scriptErgoTree }` or `{ auditedScript: "task_hash_v0" }` for mainnet.
- Verify `blake2b256(ergoTreeHex bytes)` against the audited manifest before building or signing.
- Treat arbitrary non-empty hex as unsafe on mainnet unless explicitly marked `dangerouslyAllowUnauditedErgoTree`.

### A-002 — Raw lifecycle builders are exported and can bypass high-level guardrails

The public API exports `buildCreateReserveTx`, `buildRedeemNoteTx`, `buildBatchSettleTx`, and `buildDeployTrackerTx`. Comments state that high-level SDK wraps these with production safety, but direct callers can still build unsafe mainnet transactions.

Risk: advanced users can accidentally bypass mainnet safety and publish P2PK or unaudited-script boxes.

Required fix:

- Rename exports to `dangerouslyBuild*` or move them under an explicit advanced namespace.
- Add a `network` and `auditPolicy` parameter to raw builders, or require callers to pass a pre-validated audited tree handle.
- Add lint/tests proving exported public API cannot build mainnet lifecycle transactions without an audit check.

### A-003 — `task_hash_v0` is a pure hash predicate and is front-runnable after task output is revealed

The reference `task_hash_v0` script checks only:

```ergoscript
HEIGHT < expiry && blake2b256(taskOutput) == expectedHash
```

It does not bind redemption to a receiver, a public key, a specific output, or a claimant signature. Once a valid `taskOutput` appears in the mempool, a third party can copy the context variable and race a competing spend to their own address.

Risk: the task provider can lose redemption despite doing the work.

Required fix:

- Do not use `task_hash_v0` for mainnet by default.
- Prefer `credential_v0` or introduce `bound_receiver_v0`:
  - `SELF.R7` = receiver key / address commitment.
  - predicate requires `proveDlog(receiver)` and/or checks an output pays the expected receiver.
- Document `task_hash_v0` as testnet/demo or intentionally bearer-only.

### A-004 — Context variable encoding uses a single-byte length prefix

`buildRedeemNoteTx` and `buildBatchSettleTx` encode context var 0 as:

```text
0e <lenHex> <bytes>
```

where `lenHex = taskBytes.length.toString(16).padStart(2, "0")`. This is only safe for short outputs and does not implement general Sigma varint encoding.

Risk: outputs >= 256 bytes produce malformed or ambiguous extension encoding, causing redemption failure or inconsistent SDK/interpreter behavior.

Required fix:

- For v0, enforce `taskOutput.length <= 255` and throw a typed error.
- For v1, use a real Sigma serializer from Fleet/ergo-lib rather than hand-rolled encoding.
- Add positive and negative test vectors for lengths 0, 1, 32, 255, 256.

### A-005 — ChainCash `reserve.es` contains TODOs around R5 preservation

The source comments say R5 is the tree of all note tokens issued and include TODOs to check preservation in actions. Top-up and mint-note paths currently only check `selfPreserved`, which excludes R5.

Risk: if R5 is part of the reserve invariant, action paths may allow state mutation that breaks issuance/redemption accounting.

Required fix:

- External auditor must decide whether R5 mutation is safe in these paths.
- If not safe, add `selfOut.R5[AvlTree].get == SELF.R5[AvlTree].get` to top-up and mint-note paths or formalize the intended mutation.
- Add negative tests that try to mutate R5 in top-up and mint-note actions.

### A-006 — Source-to-tree reproducibility is not yet a full audit gate

`verify.mjs` recomputes `blake2b256(ergoTreeHex bytes)` and compares it to the recorded tree hash. This catches registry tampering, but it does not prove the tree came from the reviewed source under a pinned compiler.

Risk: registry can be internally consistent while still not representing the reviewed source.

Required fix:

- Store `sourceHashBlake2b256` and `postTemplateSourceHashBlake2b256` for every entry.
- Recompile from clean checkout with pinned compiler and compare `ergoTreeHex` byte-for-byte.
- Cross-check acceptance semantics with AppKit/sigmastate-jvm or sigma-rust interpreter tests.

## High-priority issues

### A-007 — `allowInsecureDevMode` is available on mainnet

The flag is explicit, which is good for demos, but a mainnet release should not make unsafe mode easy to enable by config accident.

Recommended fix:

- Rename to `dangerouslyAllowInsecureMainnetP2PK`.
- Require both the config flag and an environment variable such as `ERGO_AGENT_ALLOW_INSECURE_MAINNET=1`.
- Never enable it in examples, MCP, hosted servers, or docs except under a red warning.

### A-008 — `SPEC.md` says an R6-less Note can be trivially satisfied, but the task predicate calls `SELF.R6.get`

The current task predicate requires R6. If R6 is absent, the script fails. If a plain expiring bearer Note is intended, it needs a separate predicate.

Recommended fix:

- Either remove the “R6 unset means trivially satisfied” statement, or add an `expiry_v0` predicate.
- Add tests for missing R6 behavior.

### A-009 — Basis reserve emergency semantics require clarification

The Basis source comments describe emergency behavior after three days. The implementation still requires the tracker data input and tracker AVL proof, and still requires the reserve owner signature. This may be intentional, but must be documented precisely.

Recommended fix:

- Define emergency redemption in `SPEC.md`: what is optional, what remains required, and who can redeem.
- Add tests for tracker signature omitted before/after emergency period.
- Add tests for tracker box/data-input availability assumptions.

### A-010 — Basis AVL update path uses `insert` with a TODO for `insertOrUpdate`

For repeated redemptions of the same `(owner, receiver)` key, correctness depends on AVL insert/update behavior. The source comment says `todo: insertOrUpdate after appkit update`.

Recommended fix:

- Auditor must verify whether second and later redemptions are actually possible and safe.
- Add an e2e test for first redemption and second partial redemption of the same pair.

## Recommended release status

Mainnet status should remain:

```text
NOT CERTIFIED FOR MAINNET
```

until an independent ErgoScript/sigma-state reviewer signs the exact audited tree manifest and all critical blockers above are closed or explicitly accepted with documented rationale.
