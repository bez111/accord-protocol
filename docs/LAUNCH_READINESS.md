# Accord Launch Readiness

Accord should not be publicly launched through HN, Reddit, X, Discord, mcp.so,
or broad community posts until the protocol surface is polished enough that the
launch points to evidence instead of asking for trust.

The launch narrative should follow
[`docs/STRATEGIC_NORTH_STAR.md`](./STRATEGIC_NORTH_STAR.md): Accord is the open
trust and receipt layer for agent commerce, not a single rail, hosted product,
or payment integration.

Issue
[#70](https://github.com/accord-protocol/accord-protocol/issues/70) is therefore
a final distribution lever, not the next engineering task.

## Launch Gate

Before public launch, the repository and website should satisfy all of these
gates:

| Gate | Required state |
|---|---|
| Source of truth | README, `docs/status.md`, security, roadmap, pilots, registry, `llms.txt`, and site pages agree on maturity and mainnet status |
| Golden path | A new developer can run the mock lifecycle, inspect receipts, run conformance, and find Sage/Base evidence without private context |
| Proof narrative | Sage Ergo, Base Sepolia, x402, Rosen, and mock rail are presented through [`docs/RAIL_MATURITY_MATRIX.md`](./RAIL_MATURITY_MATRIX.md) with links to receipts, explorer or facilitator evidence, conformance, and result records |
| Provider onboarding | A third-party provider can see how to become Accord-compatible without reverse-engineering Sage |
| Audit posture | Mainnet remains default-deny, with public manifest format and `mainnetAllowed: true` semantics explicit; detailed audit work papers remain private |
| Site polish | Mobile, status, roadmap, learn hub, security, and homepage copy are consistent and scannable |
| Launch drafts | HN/Reddit/X/Discord/mcp.so drafts point to stable pages and do not overclaim mainnet readiness |

## Pre-Launch Commands

Run these before treating the launch package as ready:

```bash
npm run release:check
npm run pilots:check
npm run pilots:sage:live
npm run site:build-learn
npm run site:check
```

For release-sensitive changes, also run the full release preflight described in
[`docs/DEVELOPER_GOLDEN_PATH.md`](./DEVELOPER_GOLDEN_PATH.md) and
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Launch Is Still Not Mainnet

Public launch may announce an open standard, testnet proofs, schemas, SDKs,
conformance, and provider onboarding. It must not imply that Accord rails are
certified for real-fund production workflows.

Mainnet promotion is a separate P5 event and requires signed external audit
manifests with exact artifact entries marked `mainnetAllowed: true`.
