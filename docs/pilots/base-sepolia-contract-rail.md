# Pilot - Base Sepolia Contract Rail

## Goal

Validate the Base/EVM Note rail on Base Sepolia before any audited mainnet
contract promotion.

## Scenario

Deploy or point at a Base Sepolia `AgentPayReserveV0` contract, run the
`agentpay-base` read/write path, then exercise the Accord rail adapter through
`@accord-protocol/rails-base`.

## Preflight

```bash
npm install --include=optional
npm run build -w agentpay-base
npm test -w agentpay-base
npm run build -w @accord-protocol/rails-base
npm test -w @accord-protocol/rails-base
npm run pilots:base:stub
```

`npm run pilots:base:stub` is a local readiness check. It exercises
`agentpay-base`, `@accord-protocol/rails-base`, receipt validation, amount
normalization, task-hash rejection, and the Base mainnet audit gate against
mock viem clients. It does not satisfy the live Base Sepolia pass criteria by
itself because it emits no explorer transaction.

## Expected Receipts

| Receipt | Expected |
|---|---|
| Agreement | `rail: "base"` with Base Sepolia payment reference |
| Verification Receipt | accepted after verifier policy passes |
| Settlement Receipt | EVM tx id or Note id tied to the Agreement hash |
| Conformance | Base rail L2/L3 checks remain passing |

## Evidence To Capture

- Full Agreement JSON and `agreement_hash`.
- Full Verification Receipt JSON and `receipt_id`.
- Full Settlement Receipt JSON with EVM tx hash or Note id.
- Base Sepolia RPC endpoint name, contract address, deployment tx, and bytecode
  hash.
- Live testnet transaction link proving reserve, Note, redemption, or refund
  behaviour for the selected path.
- Output from `npm run pilots:base:stub` showing the local contract-stub path
  remains ready before running against a funded Base Sepolia signer.
- Audit-gate output proving the contract remains testnet-only and mainnet
  default-deny.
- Conformance output showing the current achieved level or documented failure.

## Rollback Plan

- Use Base Sepolia only.
- Keep contract funding low and withdraw test funds after the pilot.
- If bytecode hash or audit-policy checks fail, preserve the observed address
  and bytecode hash in the result record.
- Do not update `AUDITED_CONTRACTS.json` to `mainnetAllowed: true`.

## Pass Criteria

- Base Sepolia tx evidence is linked.
- Settlement Receipt binds to the Agreement hash.
- Mainnet audit gate remains default-deny.
