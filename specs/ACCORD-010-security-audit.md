# ACCORD-010 — Security and audit manifest

| Status | Draft |
|---|---|
| Version | v0 |
| Last updated | 2026-05-07 |
| Editors | bez111 |
| Implements in this repo | [`SECURITY.md`](../SECURITY.md), [`docs/audit/`](../docs/audit/), [`packages/ergo-agent-scripts/data/AUDITED_ERGOTREES.json`](../packages/ergo-agent-scripts/data/AUDITED_ERGOTREES.json), [`packages/agentpay-base/data/AUDITED_CONTRACTS.json`](../packages/agentpay-base/data/AUDITED_CONTRACTS.json) |

## 1. Purpose

The Accord Protocol security model is built on two ideas:

1. **Production safety is enforced by the SDK, not by trust.** Any mainnet write goes through a two-gate guard. Mainnet bypass flags fail closed.
2. **What "audited" means is verifiable, not asserted.** The set of mainnet-allowed trees / contracts is a signed manifest. The signature comes from an external auditor. The SDK refuses to act on an unsigned manifest.

This spec describes the manifest shape, the signing workflow, and the SDK contract that consumes both.

## 2. The two-gate guard

Implemented in `assertProductionSafety()` in both [`ergo-agent-pay`](../packages/ergo-agent-pay/) and [`agentpay-base`](../packages/agentpay-base/). Conformance L3 ([ACCORD-009](./ACCORD-009-conformance.md)) probes both gates against both rails.

### 2.1 Gate 1 — Box-shape

| Network | `scriptErgoTree` (Ergo) / `contractAddress` (Base) | Behaviour |
|---|---|---|
| `testnet` | any | allowed for development |
| `mainnet` | valid audited shape | passes Gate 1 |
| `mainnet` | missing / empty / unsafe | **rejected** with `INSECURE_MAINNET_MODE` |

Legacy unsafe flags are retained only as deprecated type-surface compatibility and are rejected on mainnet.

### 2.2 Gate 2 — Audited identity

A non-empty `scriptErgoTree` / `contractAddress` only proves *some* on-chain artifact exists. Gate 2 closes the gap by requiring an `auditPolicy` callback that returns `{ ok: true }`.

The reference policy is `verifyAuditedErgoTree(...)` from [`ergo-agent-scripts`](../packages/ergo-agent-scripts/) (Ergo) and `verifyAuditedContract(...)` from [`agentpay-base`](../packages/agentpay-base/) (Base). Both check:

1. The supplied bytes hash to a manifest entry.
2. That entry has `mainnetAllowed: true`.
3. The manifest's `status` is `"signed"` (not `"draft-pre-audit"`).
4. The manifest's `auditor.signature` verifies against `auditor.publicKey` over the canonical bytes of the manifest with the signature stripped.

| Network | Verdict | Behaviour |
|---|---|---|
| `testnet` | n/a | allowed for development |
| `mainnet` | `{ ok: true }` | passes Gate 2 |
| `mainnet` | `{ ok: false }` or threw | **rejected** with `UNAUDITED_ERGOTREE` / `UNAUDITED_CONTRACT` |
| `mainnet` | not configured | **rejected** with `UNAUDITED_ERGOTREE` / `UNAUDITED_CONTRACT` |

Both gates fail closed.

## 3. The audit manifest

Two manifests, one per "settlement family":

| Manifest | Covers | Hash algorithm |
|---|---|---|
| [`AUDITED_ERGOTREES.json`](../packages/ergo-agent-scripts/data/AUDITED_ERGOTREES.json) | Ergo + Rosen rails (predicate trees) | `blake2b256(ergoTreeHex bytes)` |
| [`AUDITED_CONTRACTS.json`](../packages/agentpay-base/data/AUDITED_CONTRACTS.json) | Base / EVM rail (contract bytecode) | `keccak256(deployed bytecode)` |

The x402 rail does NOT have a manifest. Trust derives from the facilitator's signed payment proof.

### 3.1 Shape

```json
{
  "schema": "accord-protocol/audited-ergotrees/v1",
  "repo": "accord-protocol/accord-protocol",
  "manifest_created_at": "...",
  "status": "draft-pre-audit",
  "auditor": {
    "name": null,
    "publicKey": null,
    "report_url": null,
    "report_hash": null,
    "signed_at": null,
    "signature": null
  },
  "entries": [
    {
      "name": "credential_v0",
      "sourcePath": "...",
      "sourceHashBlake2b256": "<64 hex>",
      "postTemplateSourceHashBlake2b256": null,
      "ergoTreeHex": "...",
      "treeHashBlake2b256": "<64 hex>",
      "intendedSemantics": "...",
      "mainnetAllowed": false,
      "notes": "..."
    }
  ],
  "commit": "<git commit hash this manifest was generated at>"
}
```

### 3.2 Status values

- `"draft-pre-audit"` — initial state. No auditor signature. Every `mainnetAllowed` is `false`. The SDK refuses every mainnet write.
- `"signed"` — auditor signed the manifest. Some entries may be `mainnetAllowed: true`. The SDK only accepts those entries on mainnet.
- `"revoked"` — the previously-signed manifest has been revoked (e.g. a finding was discovered post-audit). Reverts to `draft-pre-audit` semantics until re-signed.

## 4. Signing flow

Detailed signing operations are coordinated privately with the external auditor. Publicly, the required outcome is:

1. The auditor independently reviews the exact source, deployed artifact, and artifact hash.
2. The manifest is updated only for artifacts the auditor approved.
3. The manifest has `status: "signed"` and approved entries have `mainnetAllowed: true`.
4. The SDK consumer pins the auditor identity or trusted manifest source in their `auditPolicy`.

The signing input is `BLAKE2b-256(canonical_json(manifest_without_signature))` — same algorithm used everywhere in this protocol (ACCORD-001 §5, ACCORD-002 §5).

## 5. Why this can't be the maintainer's signature

The maintainer wrote the source. If the maintainer's signature were sufficient to flip `mainnetAllowed: true`, the audit would be a no-op trust assertion. The two-gate guard exists specifically because **only an independent third party can produce the signature that allows mainnet writes**.

This is also why an AI assistant cannot legitimately produce this signature — the signature represents an audit conclusion that requires hands-on review of source, tooling, and manifest by a real, accountable party. The signing tool is the lever; pulling it is a deliberate human act backed by the audit work.

## 6. Threat Model Handling

The detailed v0 threat model and exploit-oriented review notes are private audit material. Publicly, the required posture is:

- mainnet remains default-deny until external audit evidence exists;
- manifests bind exact artifacts and exact hashes;
- SDK safety gates reject unaudited mainnet writes;
- conformance checks verify schema, receipt binding, transport, rail, registry, and security-gate behavior;
- wallets, verifiers, facilitators, bridges, RPC providers, and MCP hosts remain separate trust boundaries.

Passing conformance is compatibility evidence, not production audit evidence.

## 7. Vulnerability disclosure

Email the maintainer directly. Don't open public issues for security-sensitive bugs. See [SECURITY.md](../SECURITY.md) §"Reporting a vulnerability".

## 8. Operational guidance

- Run on testnet until you have a signed manifest covering the trees / contracts you'll deploy.
- When you do go to mainnet, prefer hardware-signed flows and externally audited artifacts.
- Fund a fresh address per agent so a compromise's blast radius is one Reserve.
- Configure `policy.maxSinglePayment`, `policy.maxSessionSpend`, `policy.requireApprovalAbove` even with small balances.
- Log every `unsignedTx` before signing.

## 9. Open questions (v1 candidates)

- **Multi-auditor signatures.** A manifest could carry several independent auditor signatures, requiring N-of-M to flip `mainnetAllowed: true`. Out of scope for v0.
- **Time-bounded signatures.** A signed manifest expires after N months; re-attestation required.
- **Compromise-recovery key rotation.** What happens if an auditor's signing key leaks. v0 says "issue a revocation"; v1 may add a more graceful key-rotation primitive.
