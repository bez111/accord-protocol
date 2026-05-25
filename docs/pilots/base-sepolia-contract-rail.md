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
npm run pilots:base:live
```

`npm run pilots:base:stub` is a local readiness check. It exercises
`agentpay-base`, `@accord-protocol/rails-base`, receipt validation, amount
normalization, task-hash rejection, and the Base mainnet audit gate against
mock viem clients. It does not satisfy the live Base Sepolia pass criteria by
itself because it emits no explorer transaction.

`npm run pilots:base:live` is the live Base Sepolia runner. Without
`BASE_SEPOLIA_LIVE=1` and `--live`, it only prints the missing external
inputs and sends no write transactions. When the env is present, run it as:

```bash
BASE_SEPOLIA_LIVE=1 npm run pilots:base:live -- --live
```

Required env:

- `BASE_SEPOLIA_RPC_URL`
- `BASE_SEPOLIA_BUYER_PRIVATE_KEY`
- `BASE_SEPOLIA_RESERVE_CONTRACT`
- `BASE_SEPOLIA_TOKEN_CONTRACT`

Load private values from a local untracked shell session, secret manager, or
one-off CI secret. Do not commit them into the repository.

Optional env:

- `BASE_SEPOLIA_SELLER_PRIVATE_KEY` - defaults to the buyer key for a
  single-signer smoke pilot.
- `BASE_SEPOLIA_AMOUNT` - defaults to `0.01`.
- `BASE_SEPOLIA_EXPLORER_TX_BASE` - defaults to BaseScan Sepolia tx URLs.

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
- Full Settlement Receipt JSON with EVM tx hash and Note id evidence.
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
