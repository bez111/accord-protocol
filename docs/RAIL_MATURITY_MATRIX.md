# Accord Rail Maturity Matrix

Last updated: 2026-05-24

This matrix turns the current rail work into a public operating view: what each
rail is for, what evidence exists, what receipt surface it emits, what risk
boundary applies, and what must happen before mainnet use.

No row in this matrix certifies mainnet production use. Mainnet remains
default-deny until signed audit manifests mark exact artifacts
`mainnetAllowed: true`.

## Maturity Labels

| Label | Meaning |
|---|---|
| Local lifecycle | Runs the Accord agreement / verification / settlement lifecycle without external chain or payment risk |
| Architecture evidence | Proves receipt shape and integration assumptions without live external settlement |
| Testnet evidence | Uses external testnet state or explorer evidence |
| Provider evidence | A hosted provider exposes public receipt and conformance evidence |
| Mainnet certified | Requires external audit reports and signed manifests; no current rail has this label |

## Rail Matrix

| Rail surface | Best use today | Current evidence | Receipt surface | Conformance | Risk boundary | Mainnet gate |
|---|---|---|---|---|---|---|
| Mock rail / `@accord-protocol/rails` | First developer run and CI smoke | [`2026-05-15-mock-mcp-paid-tool.md`](./pilots/results/2026-05-15-mock-mcp-paid-tool.md) | Agreement, Verification Receipt, Settlement Receipt; no chain tx | L4 local | No external settlement; useful for protocol lifecycle only | Not a mainnet rail |
| Sage on Ergo testnet | Public provider proof for Ergo Note settlement | [`2026-05-24-sage-ergo-testnet-full-receipt-recheck.md`](./pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md) | Full public Agreement, Verification Receipt, Settlement Receipt JSON; Ergo testnet tx and Note box evidence | Signed L1 provider conformance plus schema/semantic live recheck | Provider signer, verifier design, Ergo testnet availability, Note script audit status | Ergo manifests must be externally audited and exact artifacts marked `mainnetAllowed: true` |
| Base Sepolia / `@accord-protocol/rails-base` | EVM contract rail proof with live testnet transactions | [`2026-05-23-base-sepolia-contract-rail.md`](./pilots/results/2026-05-23-base-sepolia-contract-rail.md) | Agreement, Verification Receipt, Settlement Receipt; Base Sepolia deploy, approve, top-up, issue, redeem tx links | L4 local plus live Base Sepolia runner evidence | EVM contract bytecode, ERC-20 behavior, wallet/account ops, task-hash enforcement | Base manifest must be externally audited and exact bytecode marked `mainnetAllowed: true` |
| x402 / `@accord-protocol/rails-x402` | HTTP pay-before-response architecture and facilitator proof handling | [`2026-05-15-x402-stub-facilitator-integration.md`](./pilots/results/2026-05-15-x402-stub-facilitator-integration.md) | Agreement, Verification Receipt, Settlement Receipt with facilitator payment id or tx hash | L4 local stub | Facilitator trust, replay protection, payment proof verification, deployment policy | Production facilitator and replay policy must be audited and monitored; no current mainnet certification |
| Rosen / `@accord-protocol/rails-rosen` | Cross-chain wrapped-token architecture and accounting model | [`2026-05-15-rosen-stub-wrapped-token-architecture.md`](./pilots/results/2026-05-15-rosen-stub-wrapped-token-architecture.md) | Agreement, Verification Receipt, Settlement Receipt in local architecture stub | L4 local stub | Bridge assumptions, TokenMap freshness, liquidity, Ergo rail dependency | Depends on Ergo mainnet gate plus external Rosen/bridge evidence |

## How To Read This

- Passing conformance means compatibility with Accord v0 rules, not production
  safety.
- Testnet evidence proves that a flow can bind Accord receipts to external
  state, not that the rail is ready for real funds.
- Architecture evidence is useful for design review but should not be marketed
  as live settlement.
- Provider evidence should include public receipts, signed conformance output,
  public signing keys, and explicit mainnet status.

## Next Maturity Moves

1. Keep `npm run pilots:sage:live` as the public hosted-provider regression
   check.
2. Keep Base Sepolia live evidence reproducible with fresh low-balance testnet
   credentials.
3. Promote x402 from local stub to external facilitator evidence when a real
   facilitator flow is available.
4. Promote Rosen from architecture stub only after TokenMap and bridge evidence
   can be checked cleanly in CI.
5. Do not promote any row to mainnet until the relevant audit manifests contain
   exact `mainnetAllowed: true` entries.
