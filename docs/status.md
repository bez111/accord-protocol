# Status

This page is the single source of truth for what works, what does not work, and what can reach mainnet. Other docs MUST defer to this page when they conflict.

Public website: https://accordprotocol.ai/
Public status page: https://accordprotocol.ai/status/
Security page: https://accordprotocol.ai/security/

Last updated: 2026-05-24 — `v0.4.2` npm publication verified, Python reference package `0.3.2` verified on PyPI, public website and learn hub live at `accordprotocol.ai`, sitemap/RSS/LLM/agent discovery files live, GitHub repository metadata/topics updated, P4 pilot status is 5/5 complete, Base Sepolia contract rail live evidence is archived with external transaction links, Sage full receipt live recheck now passes against Accord v0 schemas and L1 conformance, and mainnet gates still default-deny.

Public launch posts, mcp.so submission, and broad community distribution remain
deferred until the pre-launch gates in [`docs/LAUNCH_READINESS.md`](./LAUNCH_READINESS.md)
pass. This is a polish gate, not a protocol-blocking failure.

## Executive summary

| Area | Status |
|---|---|
| Protocol object version | `v0` draft |
| SDK line | `0.4.2` published package line |
| Conformance | L0-L4 implemented in the reference suite |
| Recommended usage | Local demos, mock rail, testnet development, conformance testing |
| Public launch status | Deferred until launch readiness gates pass |
| Mainnet status | **NOT CERTIFIED FOR MAINNET** |
| Production use | Blocked until signed audit manifests mark relevant scripts/contracts `mainnetAllowed: true` |
| Compatibility policy | [`docs/PROTOCOL_COMPATIBILITY.md`](./PROTOCOL_COMPATIBILITY.md) |
| Package matrix | [`docs/PACKAGE_MATRIX.md`](./PACKAGE_MATRIX.md) |
| Rail maturity matrix | [`docs/RAIL_MATURITY_MATRIX.md`](./RAIL_MATURITY_MATRIX.md) |
| Mainnet audit posture | [`docs/audit/`](./audit/) |
| Package publication evidence | [`docs/release-evidence/2026-05-24-v0.4.2-publish.md`](./release-evidence/2026-05-24-v0.4.2-publish.md) |
| Public website | [`https://accordprotocol.ai/`](https://accordprotocol.ai/) |
| Public learn hub | [`https://accordprotocol.ai/learn/`](https://accordprotocol.ai/learn/) |
| Public sitemap | [`https://accordprotocol.ai/sitemap.xml`](https://accordprotocol.ai/sitemap.xml) |
| Public RSS feed | [`https://accordprotocol.ai/feed.xml`](https://accordprotocol.ai/feed.xml) |

Accord Protocol is alpha / testnet-first software. The repo may contain working code and testnet demos, but no Accord rail, Note/Reserve/Tracker script, ChainCash/Basis contract, or EVM contract is production-certified until the relevant signed audit manifests say so.

---

## Mainnet status

**`NOT CERTIFIED FOR MAINNET`.**

| Layer | Mainnet | Why |
|---|---|---|
| Ergo rail: Note / Reserve / Tracker via `@accord-protocol/rails-ergo` | Testnet only | `AUDITED_ERGOTREES.json` is `draft-pre-audit`; entries remain `mainnetAllowed: false` |
| Rosen rail via `@accord-protocol/rails-rosen` | Testnet only | Depends on the Ergo rail mainnet gate and bridge/liquidity assumptions |
| Base/EVM rail via `@accord-protocol/rails-base` | Testnet only | `AUDITED_CONTRACTS.json` is `draft-pre-audit`; entries are not mainnet-certified |
| x402 rail via `@accord-protocol/rails-x402` | Testnet / integration only | No on-chain manifest; trust depends on facilitator-signed payment proof and integration policy |
| ChainCash / Basis reference scripts | Reference / research / draft-pre-audit | Not a blanket production-safety guarantee |

The SDK enforces this with a two-gate guard in `assertProductionSafety()`:

1. **Shape gate** — refuses unsafe mainnet writes without the required audited artifact shape.
2. **Audit-identity gate** — refuses any tree/bytecode whose hash is not in the audited manifest with `mainnetAllowed: true`.

Both gates should flip from default-deny to default-allow only when an external auditor signs the relevant manifest and the manifest entry is updated to `mainnetAllowed: true`. See [`SECURITY.md`](../SECURITY.md) and [`docs/audit/`](./audit/).

For the rail-by-rail operating view, use
[`docs/RAIL_MATURITY_MATRIX.md`](./RAIL_MATURITY_MATRIX.md).
Detailed pre-mainnet audit packages are private until coordinated disclosure is appropriate.

---

## Recommended usage today

Use Accord today for:

- public protocol review through [`https://accordprotocol.ai/`](https://accordprotocol.ai/) and [`https://accordprotocol.ai/learn/`](https://accordprotocol.ai/learn/);
- local mock-rail demos;
- Ergo testnet experiments;
- x402-compatible HTTP payment architecture demos;
- MCP tool gating prototypes;
- P4 pilot dry-runs using [`docs/pilots/`](./pilots/);
- completed local mock pilot evidence in [`docs/pilots/results/2026-05-15-mock-mcp-paid-tool.md`](./pilots/results/2026-05-15-mock-mcp-paid-tool.md);
- Sage Ergo testnet settlement evidence in [`docs/pilots/results/2026-05-15-sage-ergo-testnet-note-settlement.md`](./pilots/results/2026-05-15-sage-ergo-testnet-note-settlement.md);
- Sage Ergo full receipt live recheck in [`docs/pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md`](./pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md), now `pass` with schema-valid public Agreement, Verification Receipt, and Settlement Receipt JSON;
- Rosen wrapped-token architecture evidence in [`docs/pilots/results/2026-05-15-rosen-stub-wrapped-token-architecture.md`](./pilots/results/2026-05-15-rosen-stub-wrapped-token-architecture.md);
- x402 local stub facilitator evidence in [`docs/pilots/results/2026-05-15-x402-stub-facilitator-integration.md`](./pilots/results/2026-05-15-x402-stub-facilitator-integration.md);
- Base/EVM local contract-stub readiness checks with `npm run pilots:base:stub`;
- Base Sepolia contract rail live evidence in [`docs/pilots/results/2026-05-23-base-sepolia-contract-rail.md`](./pilots/results/2026-05-23-base-sepolia-contract-rail.md);
- Base Sepolia live pilot reruns with `BASE_SEPOLIA_LIVE=1 npm run pilots:base:live -- --live` using fresh low-balance testnet credentials;
- Sage Ergo live receipt reruns with `npm run pilots:sage:live`;
- conformance testing;
- protocol/schema review;
- audit preparation.

Do not use Accord today for:

- unaudited mainnet custody;
- production credit issuance;
- production Note redemption with real funds;
- customer-facing financial workflows;
- security claims that imply audit completion.

---

## Protocol-spec status

| Spec | Status |
|---|---|
| [`ACCORD-000`](../specs/ACCORD-000-overview.md) Overview | Draft |
| [`ACCORD-001`](../specs/ACCORD-001-agreement-object.md) Agreement Object | Draft |
| [`ACCORD-002`](../specs/ACCORD-002-verification-receipt.md) Verification Receipt | Draft |
| [`ACCORD-003`](../specs/ACCORD-003-settlement-receipt.md) Settlement Receipt | Draft |
| `ACCORD-004` Accord/402 Transport | Draft |
| `ACCORD-005` Accord/MCP Transport | Draft |
| `ACCORD-006` Rails | Draft |
| `ACCORD-007` Notes & Credit | Draft |
| `ACCORD-008` Registry | Draft |
| `ACCORD-009` Conformance | Draft |
| `ACCORD-010` Security & Audit | Draft |

Stable RFCs must ship matching JSON Schemas in [`schemas/`](../schemas/) and conformance tests before being treated as stable. Compatibility rules for v0 object versions, schemas, conformance levels, SDK releases, and registry semantics are tracked in [`docs/PROTOCOL_COMPATIBILITY.md`](./PROTOCOL_COMPATIBILITY.md).

---

## SDK implementation status

### Accord Protocol layer (`@accord-protocol/*`, published `0.4.2`)

| Package | State | What it does |
|---|---|---|
| [`@accord-protocol/core`](../packages/accord-core/) | Alpha — implemented | Canonicalize / hash / validate Agreement / Verification Receipt / Settlement Receipt |
| [`@accord-protocol/mcp`](../packages/accord-mcp/) | Alpha — implemented | Accord/MCP wrapper: paywalled tools and verification hooks |
| [`@accord-protocol/gateway`](../packages/accord-gateway/) | Alpha — implemented | Accord/402 HTTP middleware and 402 challenge flow |
| [`@accord-protocol/rails`](../packages/accord-rails/) | Alpha — implemented | Shared `AccordRailAdapter` interface and `MockRailAdapter` |
| [`@accord-protocol/rails-ergo`](../packages/accord-rails-ergo/) | Alpha — testnet only | Ergo Note rail and task-hash binding |
| [`@accord-protocol/rails-rosen`](../packages/accord-rails-rosen/) | Alpha — testnet only | Rosen-bridged stablecoin rail reference |
| [`@accord-protocol/rails-base`](../packages/accord-rails-base/) | Alpha — testnet only | Base/EVM Note rail reference |
| [`@accord-protocol/rails-x402`](../packages/accord-rails-x402/) | Alpha — integration only | x402-compatible facilitator adapter |
| [`@accord-protocol/conformance`](../packages/accord-conformance/) | Alpha — implemented | L0-L4 conformance suite and CLI |
| [`@accord-protocol/buyer-policy`](../packages/accord-buyer-policy/) | Alpha — implemented | Buyer-side policy engine for agentic wallets |

### Reference / legacy rail packages (`ergo-agent-*` / `agentpay-base`, published `0.3.2`)

These are maintained reference packages. They may be API-stable within the reference line, but they are **not production-certified** and do **not** imply mainnet safety.

| Package | State | What it does |
|---|---|---|
| [`ergo-agent-pay`](../packages/ergo-agent-pay/) | Maintained reference — testnet / not production-certified | Ergo Reserve / Note / Tracker SDK |
| [`ergo-agent-cli`](../packages/ergo-agent-cli/) | Maintained reference — testnet / not production-certified | CLI for Ergo Note lifecycle |
| [`ergo-agent-api`](../packages/ergo-agent-api/) | Legacy reference | Express middleware paywall predating Accord/402 |
| [`ergo-agent-mcp`](../packages/ergo-agent-mcp/) | Legacy reference | MCP server predating Accord/MCP |
| [`ergo-agent-server`](../packages/ergo-agent-server/) | Maintained reference | Local HTTP bridge daemon |
| [`ergo-agent-scripts`](../packages/ergo-agent-scripts/) | Draft-pre-audit | ErgoScript sources and audit manifests |
| [`ergo-agent-rosen`](../packages/ergo-agent-rosen/) | Maintained reference — testnet / not production-certified | Rosen bridge glue |
| [`agentpay-base`](../packages/agentpay-base/) | Maintained reference — testnet / not production-certified | Base/EVM Reserve + Note SDK |
| `ergo-agent-pay` Python | Maintained reference | Python read-side SDK and bridge client |

---

## Conformance status

| Level | Status | Meaning |
|---|---|---|
| L0 | Implemented | Schema-compatible |
| L1 | Implemented | Transport-compatible |
| L2 | Implemented | Rail-compatible against reference rails |
| L3 | Implemented | Security-compatible guardrail checks |
| L4 | Implemented | Registry-certified shape and cross-reference checks |

Conformance passing means an implementation matches current Accord v0 rules. It does **not** mean mainnet production safety or external audit completion.

---

## Example modes

Full example inventory: [`docs/EXAMPLE_MODES.md`](./EXAMPLE_MODES.md).

| Path | Mode | Uses real funds? | Mainnet certified? |
|---|---|---:|---:|
| [`examples/15-paid-mcp-repo-audit/`](../examples/15-paid-mcp-repo-audit/) | Mock rail | No | No |
| [`examples/01-basic-payment/`](../examples/01-basic-payment/) | Ergo testnet | Testnet only | No |
| [`examples/02-note-payment/`](../examples/02-note-payment/) | Ergo testnet / architecture | Testnet only | No |
| [`examples/03-acceptance-predicate/`](../examples/03-acceptance-predicate/) | Ergo testnet / architecture | Testnet only | No |
| [`examples/05-api-payment-server/`](../examples/05-api-payment-server/) | Ergo testnet / architecture | Testnet only | No |
| [`examples/11-cross-chain-rosen/`](../examples/11-cross-chain-rosen/) | Rosen architecture / testnet-first | No | No |
| [`examples/12-paywalled-mcp/`](../examples/12-paywalled-mcp/) | Legacy MCP / testnet-first | Testnet only | No |
| [`examples/13-paywalled-langchain/`](../examples/13-paywalled-langchain/) | Legacy Ergo rail / testnet-first | Testnet only | No |
| [`examples/14-paywalled-crewai/`](../examples/14-paywalled-crewai/) | Legacy Ergo rail / testnet-first | Testnet only | No |

---

## Release status

| Item | State |
|---|---|
| Publish workflows | npm publication uses GitHub Actions Trusted Publishing/OIDC; `npm run release:check` verifies the package matrix and release gates |
| Local release preflight | `npm run release:preflight -- --allow-branch --pack` can smoke a pushed PR branch, including Python tests and venv install smoke; `npm run release:preflight:pack` is the final main-branch pack/install/conformance-CLI smoke |
| Package matrix | [`docs/PACKAGE_MATRIX.md`](./PACKAGE_MATRIX.md) tracks install status, rail scope, and mainnet posture |
| npm registry status | `npm run npm:publish-status` verified 18/18 package versions already published; 0 pending |
| PyPI registry status | `ergo-agent-pay==0.3.2` is available on PyPI as the Python reference package |
| `v0.4.2` package release | Package publication complete; this is still not a mainnet certification |
| `v0.4.1` package release | Package publication complete; this is still not a mainnet certification |
| GitHub Release | Published for `v0.4.2` with `NOT CERTIFIED FOR MAINNET` warning and links to status/security docs |

## Public discovery status

| Surface | Status |
|---|---|
| `accordprotocol.ai` production website | Live |
| `www.accordprotocol.ai` | Redirects to apex domain |
| Learn hub | Live with evergreen Accord, MCP, x402, AP2, verifier, wallet-policy, conformance, audit-gate, and rail-adapter guides |
| Sitemap | Live at [`/sitemap.xml`](https://accordprotocol.ai/sitemap.xml) |
| RSS | Live at [`/feed.xml`](https://accordprotocol.ai/feed.xml) |
| Agent/LLM discovery | `llms.txt`, `llms-full.txt`, and `agents.txt` live |
| GitHub repository metadata | Homepage set to `https://accordprotocol.ai`; topics include `mcp`, `x402`, `agent-payments`, `ai-agents`, `ergo`, `conformance`, and `protocol` |
| GitHub Release | [`v0.4.2`](https://github.com/accord-protocol/accord-protocol/releases/tag/v0.4.2) published with public website/status/security links |
| Search console submission | Deferred until [`docs/LAUNCH_READINESS.md`](./LAUNCH_READINESS.md) gates pass; then submit through project owner accounts |
| HN/Reddit/X/Discord/mcp.so posts | Drafted in [`docs/launch/`](./launch/), but deferred until launch readiness gates pass |
| Mobile website pass | Live on `accordprotocol.ai`; mobile header/menu and Learn/article readability updated |

See [`PUBLISHING.md`](../PUBLISHING.md), [`RELEASING.md`](../RELEASING.md), and [`docs/RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md) if present.

---

## Open-source vs commercial

This repository contains the open standard and reference implementations:

- specs;
- schemas;
- test vectors;
- conformance suite;
- signing infrastructure;
- TypeScript and Python SDKs;
- reference rail adapters;
- audit manifests;
- examples;
- registry previews.

Commercial products such as hosted gateways, paid dashboards, enterprise integrations, managed verifier routing, private registries, and marketplace operations should live elsewhere, for example under future `agentaccord/*` repositories.
