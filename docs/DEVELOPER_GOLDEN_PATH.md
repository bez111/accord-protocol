# Accord Developer Golden Path

This is the recommended first path for a developer, auditor, or agent that wants
to understand Accord without touching mainnet funds.

Accord is still alpha / testnet-first software. This path demonstrates the
agreement, verification, and settlement lifecycle. It does not certify mainnet
use.

## 1. Install and build

```bash
git clone https://github.com/accord-protocol/accord-protocol
cd accord-protocol
npm install
npm run build
```

## 2. Run the safest lifecycle demo

Start with the mock rail paid MCP repository audit demo. It does not require an
Ergo node, Base RPC, x402 facilitator, testnet wallet, or real funds.

```bash
cd examples/15-paid-mcp-repo-audit
npm install
npm run dev
```

Expected lifecycle:

```text
Agreement -> mock payment -> MCP wrapper -> handler -> verifier -> Verification Receipt -> Settlement Receipt
```

Inspect the emitted objects and confirm that the settlement receipt references
the verification receipt, and that both bind back to the agreement.

## 3. Run conformance

From the repository root:

```bash
npx accord-conformance --levels L0,L1,L2,L3,L4
```

Expected result for the current reference implementation:

```text
Achieved: L4
```

Conformance means compatibility with the current Accord v0 rules. It is not an
external audit and not a mainnet safety certificate.

## 4. Inspect P4 pilot evidence

The current P4 pilot matrix is machine-checked:

```bash
npm run pilots:todo
npm run pilots:check
```

Expected result:

```text
P4 pilot status: 5/5 complete, 0 pending.
```

Result records live in [`docs/pilots/results/`](./pilots/results/).

## 5. Inspect live testnet evidence

The Base Sepolia contract rail pilot is the clearest external EVM testnet proof.
It includes a deployed `AgentPayReserveV0` contract, live transaction evidence,
audit-gate output, negative task-hash rejection, and L4 conformance output.

Record:

[`docs/pilots/results/2026-05-23-base-sepolia-contract-rail.md`](./pilots/results/2026-05-23-base-sepolia-contract-rail.md)

Key external artifacts:

- Reserve contract: <https://sepolia.basescan.org/address/0x08e27593a6e89ed04eb0ebae249a460657d3cc89>
- Settlement tx: <https://sepolia.basescan.org/tx/0xf6ab7267f1ff489524d06884effa045f9430858509348cbf30970f34cb741f92>

Sage also has live Ergo testnet rail evidence and a public full receipt bundle.
The 2026-05-24 recheck now passes against current Accord v0 schemas,
hash-binding, semantic validators, and L1 conformance. Recheck it with:

```bash
npm run pilots:sage:live
```

Record:

[`docs/pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md`](./pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md)

## 6. Understand the mainnet gate

Before any real-fund workflow, read:

- [`docs/status.md`](./status.md)
- [`SECURITY.md`](../SECURITY.md)
- [`docs/audit/`](./audit/)

Mainnet writes remain default-deny until signed external audit manifests mark
exact scripts or deployed bytecode entries `mainnetAllowed: true`.

## 7. What to build next

After completing this path, the best next contribution is not another rail or a
launch post. It is making one of these surfaces easier to verify:

- clearer emitted receipt examples;
- more conformance vectors;
- better verifier assumptions;
- public signed pilot JSON artifacts;
- audit manifest review;
- simpler Accord/MCP or Accord/402 quickstarts.

For provider integrations, use [`docs/PROVIDER_ONBOARDING.md`](./PROVIDER_ONBOARDING.md).
For public launch sequencing, use [`docs/LAUNCH_READINESS.md`](./LAUNCH_READINESS.md).
Issue
[#70](https://github.com/accord-protocol/accord-protocol/issues/70) should stay
deferred until the launch readiness gates pass.
