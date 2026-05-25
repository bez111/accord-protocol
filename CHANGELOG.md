# Changelog

All notable changes to Accord Protocol and its maintained reference rail packages are documented here.

The monorepo has two release lines:

- canonical Accord packages under `@accord-protocol/*`;
- maintained reference rail packages under `ergo-agent-*`, `agentpay-base`, and Python `ergo-agent-pay`.

A public package release is not production certification. Always check `docs/status.md` and `SECURITY.md` before using any rail with real funds.

## [Unreleased]

No unreleased changes yet.

## [0.4.2] — 2026-05-23

### Evidence release

- Completed P4 pilot evidence: `docs/pilots/README.md` now reports 5/5 pilots complete and 0 pending blockers.
- Added Base Sepolia contract rail live evidence with external transaction proof, deployed `AgentPayReserveV0` address, audit-gate result, and conformance output.
- Added the public Learn article for the Base Sepolia contract rail evidence and rebuilt the public status/roadmap surfaces.
- Added `docs/DEVELOPER_GOLDEN_PATH.md` and refreshed strategy/status docs around the post-P4 developer path.

### Base/EVM rail

- Fixed `agentpay-base` live write calls so viem receives the wallet account object, not only the buyer address, avoiding the `unknown account` failure in local-account flows.
- Hardened the Base Sepolia live pilot runner with state-visibility waits before it checks settlement state.

### Public site

- Improved the mobile website experience with a responsive navigation menu, better small-screen spacing, and article/readability fixes.
- Kept the public website, RSS, sitemap, `llms.txt`, `llms-full.txt`, and `agents.txt` as the canonical discovery surfaces.

### Public discovery

- Launched the canonical public website at `https://accordprotocol.ai/` with
  Learn, Status, Security, Roadmap, sitemap, RSS, `llms.txt`, `llms-full.txt`,
  and `agents.txt` surfaces.
- Added evergreen Learn articles for the agent payments stack, payment vs work
  verification, paid MCP tool production readiness, verifier design, agent
  wallet policy, and conformance/audit/mainnet gates.
- Updated GitHub repository homepage/topics and package metadata links to point
  at canonical public Accord documentation.
- Added launch/outreach drafts for GitHub Release, HN, Reddit, X, Discord,
  MCP/x402/Ergo communities, mcp.so, and design-partner outreach.

### Release posture

- Canonical Accord packages move to `0.4.2`.
- Maintained reference npm packages and the Python reference package move to `0.3.2`.
- Accord remains **NOT CERTIFIED FOR MAINNET**; no audit manifest entry is promoted to `mainnetAllowed: true`.

## [0.4.1] — 2026-05-15

### Release recovery

`v0.4.0` was already tagged and published from an older commit, so this release
line carries the current hardened `main` state under fresh package versions:
canonical Accord packages move to `0.4.1`, while maintained reference packages
and the Python package move to `0.3.1`.

### Post-`v0.4.0` release-pipeline polish

The `v0.4.0` tag was pushed with all 18 packages already on the npm registry. The following changes landed on `main` after the tag to make the publish workflows reproducible from `workflow_dispatch` going forward:

- **publish-npm.yml** — added a `Build deps` step to the five legacy jobs (`ergo-agent-cli`, `ergo-agent-api`, `ergo-agent-mcp`, `ergo-agent-server`, `ergo-agent-rosen`) so each builds its upstream workspaces before its own `Build` / `Test` step. Each job runs in a fresh checkout; `needs:` enforces ordering, not artifact transfer. (PR #59)
- **`packages/ergo-agent-py/pyproject.toml`** — fixed invalid `build-backend` (`setuptools.backends.legacy:build` → `setuptools.build_meta`). Without this fix, `python -m build` failed in CI. (PR #59)
- **publish-npm.yml / publish-pypi.yml** — re-enabled `workflow_dispatch:` so the publish pipelines can be re-run manually after fixes without re-pushing a tag. (PR #60)
- **publish-pypi.yml** — added `packages-dir: packages/ergo-agent-py/dist` to the `pypa/gh-action-pypi-publish` step. The action runs in a Docker container that ignores the job-level `defaults.run.working-directory`. (PR #61)
- **All workspace `package.json` files** — normalized `repository.url` to `git+https://...` form to remove the per-publish `npm auto-corrected` warning.
- **Release readiness / publish gates** — added a release-readiness CI workflow, npm prepublish gates before any package publish job, CommonJS export smoke coverage, packaged conformance CLI smoke outside the monorepo, Python unit/install smoke coverage, and PR/issue template path coverage. (PR #63)
- **Pilot and contributor docs** — added P4 pilot runbooks, recorded the first local mock MCP pilot result, refreshed contributor/release docs, and kept all public wording aligned with the default-deny mainnet posture. (PR #63)

### Examples

- **examples/13-paywalled-langchain** — LangChain `BaseTool` whose `_run`
  is paywalled by an Ergo Note. Mirrors v2 PolicyEngine on the buyer side
  (`pricing_policy.py`) with stub-bridge / stub-HTTP unit tests that don't
  require LangChain installed. (PR #17)
- **examples/14-paywalled-crewai** — CrewAI counterpart with a shared
  `PaymentPolicy` instance gating the whole crew. Adds a regression test
  asserting `max_session_spend` caps cumulative spend across multiple
  agents using the same policy. (PR #17)

### CI

- `ci.yml`, `ci-mcp.yml`, `ci-scripts.yml` switched to root `npm install` +
  `npm run X -w pkg`; the per-package `cd … && npm install` pattern broke
  after npm-workspaces hoisting in PR #14. (PR #17)
- `ci-mcp.yml` now builds `ergo-agent-api` before MCP typecheck (MCP
  imports its types) and re-triggers on `packages/ergo-agent-api/**`. (PR #17)
- `ci-python.yml` Unit-tests job dropped `cache: pip` (no install step,
  cache action errored on the post-cleanup hook). (PR #17)
- `ergo-agent-py` source annotated for `mypy --strict` — the strictness
  was already declared in `pyproject.toml` but the source was lagging.
  `bridge.py`, `client.py`, `network.py`, `types.py` now pass cleanly. (PR #17)

### Audit follow-ups

- `SPEC.md` clarified v0 Note register requirements.
- `encodeSigmaCollByte` and `decodeRegisterInt` hardening were locked with
  regression tests.
- Manifest-backed mainnet gating now keeps unaudited entries
  `mainnetAllowed=false` until signed external audit evidence exists.


## [0.4.0] — 2026-05-11

### Added

- Introduced the canonical Accord Protocol package layer under `@accord-protocol/*`:
  `core`, `mcp`, `gateway`, `rails`, `rails-ergo`, `rails-rosen`, `rails-base`,
  `rails-x402`, `conformance`, and `buyer-policy`.
- Added Accord v0 protocol objects: Agreement, Verification Receipt, and Settlement Receipt.
- Added Accord/402, Accord/MCP, rail-adapter, conformance, and buyer-policy packages.
- Added L0-L4 conformance suite and CLI.
- Added release-readiness checks and updated package publishing docs.

### Changed

- Reframed the project from `ergo-agent-economy` to Accord Protocol: an open standard for autonomous agent work agreements.
- Clarified that Ergo is the first reference programmable-settlement rail, not the only possible rail.
- Clarified that ChainCash/Basis is reference / research / draft-pre-audit material, not production certification.
- Updated README, status, security, release, publishing, and LLM-facing documentation around one testnet-first posture.

### Safety

- Accord remains **NOT CERTIFIED FOR MAINNET**.
- No audit manifest entry is promoted to `mainnetAllowed: true` by this release.
- Package publication does not imply production safety.

---

## [0.3.0] — 2026-05-06

This is the **monorepo release**: every package goes from individual,
`file:`-linked dev versions to coordinated `^0.3.0` versions resolvable
from npm and PyPI.

### New packages

| Package | What |
|---|---|
| `ergo-agent-cli` | Command-line companion to `ergo-agent-pay` (`balance`, `note check/issue/redeem`, `reserve create`, `tracker deploy`, `settle`, `task-hash`). |
| `ergo-agent-api` | Express/Connect-compatible middleware that turns any endpoint into a paid API: 402 + Note verification + replay protection + inline redemption. |
| `ergo-agent-server` | Local HTTP bridge — exposes the SDK over REST so any language can drive it. |
| `ergo-agent-scripts` | Canonical ErgoScript sources for v0 predicates and ChainCash / Basis contracts; compiled ergoTree manifest with audit gate. |
| `ergo-agent-rosen` | Cross-chain integration via Rosen Bridge — agents pay in rsUSDT/rsUSDC bridged from Ethereum / Bitcoin / Cardano. |

### Protocol & safety

- **AgentPay v0 spec** ([SPEC.md](./SPEC.md)) — formalised primitives, register layout, audit-manifest contract, conformance rules.
- **Two-gate mainnet safety**:
  1. *Shape gate* — refuse unsafe mainnet writes without the required audited artifact shape.
  2. *Audit-identity gate* — refuse any tree whose hash is not in `AUDITED_ERGOTREES.json` with `mainnetAllowed: true`.
- **BLAKE2b-256** — replaced the SHA-256 placeholder; cross-language golden vectors at `test-vectors/task-hash.json`.
- **Audited tree manifest** — `AUDITED_ERGOTREES.json` carries source hashes, post-template hashes, tree hashes, and per-entry `mainnetAllowed` flags. Status defaults to `draft-pre-audit`.
- **Private audit-review fixes** — incorporated maintainer review hardening while keeping detailed audit work papers out of the public repository.

### Lifecycle & policy

- **Policy v2** — `recipientAllowlist`, `recipientBlocklist`, `perRecipientCap`, `dailyBudget`, structured `auditLog` sink. Decision order documented in `docs/policy-engine.md`.
- **Raw builders internalized** — high-level SDK methods are the public path so mainnet safety checks run before signing.
- **`encodeSigmaCollByte`** — replaces hand-rolled length encoding; enforces `taskOutput.length <= 255` for the v0 single-byte length prefix.

### Cross-language & ergonomics

- **Python `BridgeClient`** — talks to `ergo-agent-server` over HTTP; preserves `ErgoAgentPayError.code` round-trip.
- **MCP lifecycle tools** — Reserve / Note / Tracker tools usable directly from Claude / Cursor / Windsurf.
- **End-to-end demo** — `examples/07-end-to-end-agent-economy/`: composes every package into one runnable agent-pays-agent flow.
- **Cross-chain demo** — `examples/11-cross-chain-rosen/`: agent on Ethereum holds USDT, bridges to rsUSDT once, pays sellers via the audited `basis_token_reserve_v0`.

### Audit pipeline

- **`docs/audit/`** — auditor request, mainnet audit procedure, pre-audit findings, hardening checklist, deep review, resolution table.
- **CI determinism gate** — `scripts/compile-predicates.mjs` recompiles every entry on every PR and fails if the bytes drift.

### Infra

- **Monorepo via npm workspaces** — local dev resolves cross-package deps automatically; published versions resolve via `^0.3.0` ranges.
- **`publish-npm.yml`** — tag-triggered, publishes all seven TS packages in dependency order. Foundation (`ergo-agent-pay`, `ergo-agent-scripts`) goes first; dependents short-circuit on foundation failure.
- **`publish-pypi.yml`** — Trusted Publishing (no static token).
- **`RELEASING.md`** — release runbook.

### Status

`NOT CERTIFIED FOR MAINNET`. Every entry in `AUDITED_ERGOTREES.json` is
`mainnetAllowed: false` until an external auditor signs the manifest.

---

## [0.2.0] — 2026-03-21

### Added

**Full Note lifecycle** — the SDK now covers the complete Reserve → Note → Tracker pipeline:

- `agent.checkNote(boxId)` — fetch Note from blockchain, decode R4-R7 registers, return `NoteInfo` with `isExpired` flag
- `agent.redeemNote(opts)` — spend a Note, release ERG to receiver; injects context variable 0 for acceptance predicate verification
- `agent.createReserve(config)` — deploy a Reserve collateral box (P2PK for dev, custom ErgoScript for production)
- `agent.deployTracker(config)` — deploy an anti-double-spend Tracker box with empty spent set
- `agent.settleBatch(opts)` — redeem multiple Notes in a single transaction with per-input context variables

**Lifecycle methods** (for custom signing flows):
- `agent.createReserve(config)`
- `agent.redeemNote(opts)`
- `agent.settleBatch(opts)`
- `agent.deployTracker(config)`

**Register decode helpers:**
- `decodeRegisterInt(hex)` — SInt zigzag decode
- `decodeRegisterBytes(hex)` — SColl[SByte] strip type prefix

**New types** (all exported from package root):
`NoteInfo`, `ReserveConfig`, `ReserveResult`, `RedeemOptions`, `RedeemResult`,
`BatchSettleOptions`, `BatchSettleResult`, `TrackerConfig`, `TrackerResult`

**New error codes:**
`BOX_NOT_FOUND`, `NOTE_EXPIRED`, `NOTE_INVALID`

**New examples:**
- `04-orchestrator-budget` — orchestrator issues budgeted Notes to 3 sub-agents with acceptance predicates
- `05-api-payment-server` — Express server verifies Note on-chain before serving; client demo
- `06-python-agent` — Python/LangChain agent that pays for API calls using Ergo Notes

**Network client:**
- `NetworkClient.getBox(boxId)` — fetch any UTxO by ID

**Documentation:**
- `docs/api-reference.md` — full API reference for all methods, types, error codes

---

## [0.1.0] — 2026-03-18

### Added

Initial release.

- `ErgoAgentPay` class with `pay()` and `issueNote()`
- Policy engine: `maxSinglePayment`, `maxSessionSpend`, `requireApprovalAbove`, `beforePay`/`afterPay` hooks
- LangChain adapter: `asLangChainTool()`
- OpenAI function calling adapter: `asOpenAIFunction()`
- Acceptance predicate helpers: `computeTaskHash()`, `computeTaskHashAsync()`, `validateTaskHash()`
- `resolveDeadline(deadline, currentBlock)` for block-relative expiry
- `parseAmount(amount)` — parse `"N ERG"` strings to nanoERG bigint
- `NetworkClient` — Ergo node API client (height, UTxOs, balance, submit)
- Examples: 01-basic-payment, 02-note-payment, 03-acceptance-predicate
- `docs/primitives.md` — Reserve / Note / Tracker / Acceptance Predicate reference
- `docs/why-ergo.md` — rationale for building on Ergo vs other chains
- `llms.txt` — machine-readable reference for LLM agents
