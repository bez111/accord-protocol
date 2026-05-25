# Security Policy

## Status Summary

Accord Protocol is alpha / testnet-first software.

- **Mainnet status:** `NOT CERTIFIED FOR MAINNET`.
- **Mainnet writes:** blocked by default until signed external audit manifests mark exact artifacts `mainnetAllowed: true`.
- **Recommended usage:** local demos, mock rails, conformance tests, and testnet experiments.
- **Do not use unaudited Accord rail scripts, contracts, or predicates with real funds.**

See [`docs/status.md`](docs/status.md) for the public status page.

## Reporting A Vulnerability

Please do not open a public GitHub issue for security-sensitive bugs.

Preferred reporting channels:

1. Use GitHub private vulnerability reporting / Security Advisory flow if enabled for this repository.
2. Email `security@agentaccord.com` once configured.
3. If neither channel is available, contact the maintainer listed in [`MAINTAINERS.md`](MAINTAINERS.md) and request a private reporting channel.

Include the affected component, a concise vulnerability description, minimal reproduction context, expected impact, and whether you want credit.

We aim to acknowledge security reports within seven days. Public disclosure should happen only after a fix, mitigation, or coordinated advisory plan is ready.

## Mainnet Gate

Production mainnet eligibility requires all of the following:

1. The exact source, network, deployed artifact, and artifact hash are identified.
2. An independent external auditor publishes or signs a report covering that exact artifact.
3. The relevant manifest is signed and marks only approved artifacts `mainnetAllowed: true`.
4. Public status, release notes, and integration docs match the approved scope.

Tests, conformance output, testnet pilots, maintainer statements, and successful experiments are not production audit evidence.

## Public Posture

The public repository should expose the protocol, schemas, reference implementations, conformance suite, status, and audit gate rules. Detailed threat models, exploit-oriented findings, auditor work papers, and private audit handoff material are not stored in the public repository.

## Operational Guidance

- Use testnet until relevant manifests are externally audited.
- Use fresh low-balance addresses for test agents.
- Configure policy caps: max single payment, session spend, daily spend, allowlists, and approval thresholds.
- Log every unsigned transaction before signing.
- Treat wallets, bridges, verifiers, facilitators, RPC providers, and MCP hosts as separate trust boundaries.
- Passing conformance does not mean a component is audited or production-certified.
