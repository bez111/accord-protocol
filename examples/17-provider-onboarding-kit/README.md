# Accord Provider Onboarding Kit

This is a copyable starter kit for an API, MCP tool, agent service, or hosted
workflow that wants to become Accord-compatible.

Mode: template only. It does not touch a chain, move funds, or certify mainnet
use.

## What This Kit Contains

```text
examples/17-provider-onboarding-kit/
├── .well-known/accord/index.json
├── .well-known/accord/agreement-template.json
├── provider-profile.json
├── receipts/agreement.json
├── receipts/verification-receipt.json
├── receipts/settlement-receipt.json
├── badge.md
└── registry-pr.md
```

## Provider Path

1. Copy `.well-known/accord/` to your provider domain.
2. Replace `provider://example-accord-provider`, URLs, prices, rails, verifier
   IDs, and evidence URIs with your real provider data.
3. Emit the three receipt objects in `receipts/`: Agreement, Verification
   Receipt, and Settlement Receipt.
4. Validate the objects with `@accord-protocol/core` and the public schemas.
5. Run conformance against your endpoint.
6. Sign the conformance result.
7. Open a registry PR using `provider-profile.json` and `registry-pr.md`.

## Validation

Install the public packages in your project:

```bash
npm install --save-dev @accord-protocol/core @accord-protocol/conformance
```

Run semantic validation in your own test suite:

```ts
import {
  validateAgreement,
  validateVerificationReceipt,
  validateSettlementReceipt,
} from "@accord-protocol/core";
```

For a hosted endpoint, run network conformance:

```bash
npx accord-conformance run \
  --levels L0,L1 \
  --target https://provider.example/api/run \
  --json > conformance-result.json
```

Then sign and verify the result:

```bash
npx accord-conformance keygen
npx accord-conformance sign --key-file ./private-conformance-key.txt conformance-result.json > conformance-result.signed.json
npx accord-conformance verify --expected-key 0xYOUR_PUBLIC_KEY conformance-result.signed.json
```

## Badge Language

Use `badge.md` as the source for compatibility language. Do not claim mainnet
certification unless signed external audit manifests explicitly allow the exact
scripts or contracts used by your rail.

## Evidence Checklist

Before submitting a registry profile, publish:

- provider `.well-known/accord` endpoint;
- sample Agreement JSON;
- sample Verification Receipt JSON;
- sample Settlement Receipt JSON;
- conformance result JSON;
- signed conformance result JSON;
- public signing key;
- rail-specific explorer or facilitator evidence when applicable;
- explicit mainnet and audit status.

## What This Does Not Prove

This kit proves that a provider has a public Accord-shaped integration path. It
does not prove that the provider is honest, that verifier design is correct, or
that any rail is safe for real-fund production workflows.
