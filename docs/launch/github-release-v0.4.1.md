# Accord Protocol v0.4.1

Accord Protocol v0.4.1 is the current published package line for the open Accord standard and reference implementation.

Accord turns paid agent requests into explicit work agreements: what was promised, how payment authority or proof is represented, how completion is verified, and how settlement evidence is recorded.

## Public links

- Website: https://accordprotocol.ai/
- Learn hub: https://accordprotocol.ai/learn/
- Public status: https://accordprotocol.ai/status/
- Security posture: https://accordprotocol.ai/security/
- Roadmap: https://accordprotocol.ai/roadmap/
- Sitemap: https://accordprotocol.ai/sitemap.xml
- RSS feed: https://accordprotocol.ai/feed.xml

## Published package line

- Canonical Accord packages: `@accord-protocol/*@0.4.1`
- Maintained legacy/reference packages: `ergo-agent-*@0.3.1` and `agentpay-base@0.3.1`
- Python reference package: `ergo-agent-pay==0.3.1`

See the package matrix for the current package-by-package posture:

https://github.com/accord-protocol/accord-protocol/blob/main/docs/PACKAGE_MATRIX.md

## What is included

- Accord Agreement Object, Verification Receipt, and Settlement Receipt v0 draft objects.
- TypeScript core SDK for canonicalization, hashing, and validation.
- Accord/MCP wrapper for paid and verifiable MCP tools.
- Accord/402 HTTP middleware for agreement-scoped paid HTTP flows.
- Shared rail-adapter interface and reference adapters for mock, Ergo, Rosen, Base/EVM, and x402-compatible flows.
- L0-L4 conformance suite and CLI.
- Buyer-side policy package for agent wallet spend controls.
- Public learn hub, sitemap, RSS feed, `llms.txt`, `llms-full.txt`, and `agents.txt`.

## Safety posture

Accord Protocol v0 is alpha / testnet-first and **NOT CERTIFIED FOR MAINNET**.

Production use is blocked until signed audit manifests mark the exact relevant scripts or contracts as `mainnetAllowed: true`.

Conformance means compatibility with current Accord v0 rules. It does not mean external audit completion, verifier honesty, rail safety, bridge safety, facilitator safety, or real-fund production readiness.

Use Accord today for local mock-rail demos, conformance testing, MCP tool-gating prototypes, Accord/402 architecture demos, testnet experiments, protocol review, and audit preparation.

Do not use Accord today for unaudited mainnet custody, production credit issuance, production Note redemption with real funds, or customer-facing financial workflows.

## Recommended first demo

The safest first hands-on path is the mock paid MCP repository audit demo:

https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit

It runs the full Agreement -> payment/mock rail -> tool execution -> Verification Receipt -> Settlement Receipt lifecycle without real funds.
