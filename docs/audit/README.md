# Audit and Mainnet Certification

This public folder states Accord Protocol's production posture without exposing
private audit working papers.

## Current state

Accord Protocol is `NOT CERTIFIED` for production mainnet use.

- Mainnet writes are denied by default.
- Testnet pilots and conformance output are compatibility evidence, not audit evidence.
- No artifact may be promoted to `mainnetAllowed: true` without an external audit that covers the exact deployed artifact.

## Public rule

A component is considered production-audited only when all of the following are true:

1. The exact source, network, deployed artifact, and artifact hash are identified.
2. An independent external auditor publishes or signs a report covering that exact artifact.
3. The relevant manifest is updated with `status: "signed"` and `mainnetAllowed: true` only for approved artifacts.
4. The release notes and public status page are updated to match the approved scope.

Maintainer claims, tests, testnet demos, conformance output, and successful experiments do not count as production audit evidence.

## Public docs

- [`MANIFEST_FORMAT.md`](./MANIFEST_FORMAT.md)
- [`MAINNET_CERTIFICATION.md`](./MAINNET_CERTIFICATION.md)
- [`../status.md`](../status.md)
- [`../../SECURITY.md`](../../SECURITY.md)

Detailed threat models, private findings, auditor work papers, and exploit-oriented review notes are not stored in the public repository.
