# PR Hardening Checklist Before External Mainnet Audit

## 1. Enforce audited tree identity

- [ ] Add `AUDITED_ERGOTREES.json` to repo root or `packages/ergo-agent-scripts/data/`.
- [ ] Add `sourceHashBlake2b256` and `postTemplateSourceHashBlake2b256` to registry entries.
- [ ] Add `verify-audited-manifest` script.
- [ ] Make high-level SDK reject mainnet `scriptErgoTree` unless its hash matches a named audited manifest entry.
- [ ] Add tests: arbitrary non-empty mainnet tree is rejected.

## 2. Remove unsafe mainnet bypasses from default API

- [ ] Rename `allowInsecureDevMode` to `dangerouslyAllowInsecureMainnetP2PK`.
- [ ] Require environment variable opt-in as well as config opt-in.
- [ ] Ensure MCP/server/examples never set the dangerous flag.

## 3. Protect raw builders

- [ ] Rename exported raw builders to `dangerouslyBuildCreateReserveTx`, `dangerouslyBuildRedeemNoteTx`, etc., or move under `advanced` namespace.
- [ ] Add docs warning that raw builders do not enforce mainnet audit policy.
- [ ] Add test proving high-level SDK applies audit policy while raw builders require explicit dangerous import.

## 4. Fix context-variable encoding

- [ ] Add `encodeSigmaCollByte(bytes)` helper.
- [ ] For v0, throw if `bytes.length > 255`.
- [ ] Add test vectors for 0, 1, 32, 255, and 256 bytes.
- [ ] Use the helper in single redemption and batch settlement.

## 5. Change mainnet default predicate

- [ ] Mark `task_hash_v0` as `mainnetAllowed: false` unless front-running is explicitly accepted.
- [ ] Use `credential_v0` or new `bound_receiver_v0` for mainnet examples.
- [ ] Add mempool-copy/front-run section to `SECURITY.md`.

## 6. Resolve contract TODOs before audit

- [ ] Resolve ChainCash `reserve.es` R5 preservation TODOs.
- [ ] Resolve Basis `insertOrUpdate` TODO or document exactly why `insert` is safe for repeated redemptions.
- [ ] Add negative tests for the resolved invariants.

## 7. Add interpreter-level tests

- [ ] Positive spend: valid task hash before expiry.
- [ ] Negative spend: valid task hash at/after expiry.
- [ ] Negative spend: wrong task output.
- [ ] Negative spend: wrong tree hash / unaudited tree.
- [ ] ChainCash redemption with fake oracle NFT fails.
- [ ] Basis double redemption / stale timestamp fails.

## 8. Mainnet release label

- [ ] Keep `SPEC.md` status as `draft, testnet-only` until external audit signs the manifest.
- [ ] Add `SECURITY.md` with “not mainnet certified” warning.
- [ ] After audit, update status to `mainnet-beta` only for audited entries.
