# Accord Provider Onboarding

This is the shortest path for a service, API, MCP tool, or agent to become
Accord-compatible.

Accord-compatible does not mean mainnet-certified. It means the provider can
emit and validate the protocol objects that describe work, verification, and
settlement.

Start from the copyable kit in
[`examples/17-provider-onboarding-kit`](../examples/17-provider-onboarding-kit/).
It includes `.well-known/accord` files, sample receipt JSON, a registry profile,
badge language, and a registry PR template.

## 1. Pick The Work Surface

Define the paid work in one sentence:

- what the buyer asks for;
- what output the provider returns;
- what verifier decides acceptance;
- what rail proves payment or settlement.

Good first provider surfaces are narrow: repository audit, paid API response,
code review, data transformation, model evaluation, or research answer.

## 2. Emit An Agreement

The provider must create an Accord Agreement that answers:

- buyer and seller identity;
- task kind, input reference, and output schema;
- payment rail, asset, amount, and deadline;
- verifier identity and acceptance rule;
- metadata needed for audit or replay protection.

Use the public schema as the contract:

`/schemas/agreement.v0.schema.json`

## 3. Verify Work Separately From Payment

A payment proof is not enough. The provider needs a verifier that can produce a
Verification Receipt bound to the Agreement.

The verifier may be:

- deterministic tests;
- schema validation;
- a human reviewer;
- a model-assisted rubric;
- a committee or service-specific oracle.

Use the public schema:

`/schemas/verification-receipt.v0.schema.json`

## 4. Record Settlement

After work is verified, the provider emits a Settlement Receipt that records the
rail, amount, status, transaction or proof reference, and the Verification
Receipt hash it settles against.

Use the public schema:

`/schemas/settlement-receipt.v0.schema.json`

## 5. Run Conformance

Run the reference conformance suite before publishing provider claims:

```bash
npx accord-conformance --levels L0,L1,L2,L3,L4
```

For hosted endpoints, add a provider endpoint that can answer Accord challenge
and payment flows, then run the relevant L1 checks.

## 6. Publish Evidence

Provider evidence should include:

- public endpoint URL;
- sample Agreement JSON;
- sample Verification Receipt JSON;
- sample Settlement Receipt JSON;
- receipt hashes;
- conformance output;
- rail-specific explorer or facilitator evidence when applicable;
- explicit mainnet status.

Sage is the current public example of this shape:

- receipt API:
  `https://www.ergoblockchain.org/api/sage/receipt/f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81`
- result record:
  [`docs/pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md`](./pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md)

## 7. Register Carefully

A registry entry should not overclaim. It should name:

- provider identity;
- supported rails;
- conformance level;
- latest evidence URI;
- verifier assumptions;
- mainnet status;
- audit status.

Mainnet status must remain default-deny unless signed audit manifests explicitly
allow the exact deployed artifact.

Use
[`examples/17-provider-onboarding-kit/provider-profile.json`](../examples/17-provider-onboarding-kit/provider-profile.json)
and
[`examples/17-provider-onboarding-kit/registry-pr.md`](../examples/17-provider-onboarding-kit/registry-pr.md)
as the starting point for a registry submission.
